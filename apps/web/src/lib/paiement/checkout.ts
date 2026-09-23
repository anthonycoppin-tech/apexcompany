import 'server-only';

import { randomUUID } from 'node:crypto';

import { ipDeLaRequete } from '@/lib/auth/ip-demande';
import { versionAcceptation } from '@/lib/legal/acceptation';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { centsVersDecimal } from '@/lib/paiement/montants-whop';
import { whopAppel, whopCompte } from '@/lib/whop';

export type FormationAPayer = {
  id: string;
  titre: string;
  type_produit: string;
  devise: string | null;
  /**
   * Pour un abonnement, la période de facturation en jours (30 ou 365).
   *
   * **Elle doit être la même des deux côtés.** `traiter_paiement()` ouvre
   * l'accès pour cette durée ; si Whop prélevait sur un rythme différent, le
   * client paierait douze fois un accès qui n'en couvre qu'un — ou l'inverse.
   * D'où une seule source : le produit.
   */
  duree_acces_jours: number | null;
};

type ConfigurationWhop = { id?: string; purchase_url?: string | null };

/**
 * Ouvrir une session de paiement Whop et déposer la commande en attente.
 *
 * Deux parcours mènent au paiement et doivent produire exactement la même
 * chose en base : la proposition émise après l'audit (accompagnements et
 * formations) et la souscription directe à un abonnement, décidée le
 * 8 septembre 2026. Les écrire deux fois, c'est se garantir que l'un des deux
 * finira par oublier les métadonnées — et sans elles, le webhook ne sait pas
 * qui a payé quoi.
 *
 * Trois points qui ne se négocient pas :
 *
 * - **Le montant vient de l'appelant, jamais du navigateur.** C'est la seule
 *   façon d'être sûr que le prix payé est celui qui a été proposé ou affiché.
 * - **Les métadonnées sont le seul lien entre Whop et notre base.** Le webhook
 *   n'a rien d'autre pour rattacher l'encaissement à un client et à un produit.
 * - **La commande est déposée en `en_attente` avant la redirection**, pour
 *   qu'un paiement ouvert laisse une trace même si la personne abandonne sur la
 *   page de Whop. C'est le webhook qui la passera en `payee` — jamais l'écran
 *   qui l'a ouverte, qui ne sait pas si l'argent est arrivé.
 *
 * **Le prix est déclaré à la volée, jamais repris d'un plan Whop existant.**
 * Le client a bien seize plans tout faits, mais une proposition émise par un
 * formateur porte un montant libre et sans plafond (§8.6) : un lien de plan
 * figé ne sait pas transporter une remise. C'est la même raison qui faisait
 * qu'on ne tenait pas non plus de catalogue Stripe en double — un catalogue en
 * double est un catalogue qui diverge.
 */
export async function ouvrirCheckout({
  userId,
  email,
  formation,
  montantCents,
  propositionId,
  urlSucces,
}: {
  userId: string;
  email?: string;
  formation: FormationAPayer;
  montantCents: number;
  propositionId?: string;
  urlSucces: string;
}): Promise<{ url: string } | { erreur: string }> {
  const abonnement = formation.type_produit === 'abonnement';
  const devise = (formation.devise ?? 'EUR').toUpperCase();
  const textesAcceptes = versionAcceptation(formation.type_produit);

  // ── La preuve d'acceptation, avant tout paiement ──────────────────────
  // L'appelant a vérifié les deux cases (`acceptationManquante`) ; on les
  // enregistre ici, une seule fois pour les deux parcours. **Pas de preuve,
  // pas de vente** : une vente sans acceptation enregistrée, c'est une
  // rétractation qui ne s'éteint jamais et des CGV qu'on ne peut pas opposer.
  // Écrit avant l'appel à Whop, parce que c'est l'ordre réel des gestes.
  const { error: erreurPreuve } = await createServiceRoleClient()
    .from('consents')
    .insert({
      user_id: userId,
      email: email ?? null,
      type: 'cgv',
      accorde: true,
      version_texte: textesAcceptes,
      ip: await ipDeLaRequete(),
    });
  if (erreurPreuve) {
    return { erreur: 'Le paiement n’a pas pu être ouvert. Réessayez dans un instant.' };
  }

  // Notre propre référence de commande, tirée AVANT l'appel et transportée par
  // les métadonnées, qui font l'aller-retour de façon documentée.
  //
  // Pourquoi ne pas prendre l'identifiant que Whop renvoie : on ne l'obtient
  // qu'après la création, donc il ne peut pas être dans les métadonnées de
  // cette même création, et rien dans la documentation ne garantit que le
  // paiement le rapportera. Sans référence commune, `traiter_paiement()` ne
  // retrouverait pas la commande déposée en attente et en créerait une
  // seconde : la première resterait `en_attente` pour toujours, et le
  // back-office montrerait deux commandes pour un seul achat.
  const reference = randomUUID();

  try {
    const configuration = await whopAppel<ConfigurationWhop>('/checkout_configurations', {
      methode: 'POST',
      corps: {
        account_id: whopCompte(),
        currency: devise,
        redirect_url: urlSucces,
        metadata: {
          user_id: userId,
          formation_id: formation.id,
          commande: reference,
          ...(propositionId ? { proposition_id: propositionId } : {}),
          textes_acceptes: textesAcceptes,
        },
        plan: {
          title: formation.titre,
          currency: devise,
          // Whop veut des décimales là où tout notre modèle est en centimes
          // entiers. La conversion est isolée et testée dans
          // `montants-whop.ts` — jamais un `montant / 100` au fil de l'eau.
          initial_price: centsVersDecimal(montantCents),
          plan_type: abonnement ? 'renewal' : 'one_time',
          ...(abonnement
            ? {
                renewal_price: centsVersDecimal(montantCents),
                // La période du produit, pas une constante : APEX PRIME se vend
                // au mois et à l'année depuis le 23 septembre. La base garantit
                // qu'un abonnement en déclare une ; le `?? 30` n'est là que
                // pour le type, et ne devrait jamais servir.
                billing_period: formation.duree_acces_jours ?? 30,
              }
            : {}),
          // Un plan par paiement : deux clients au même prix ne doivent pas
          // partager un plan, sinon une remise accordée à l'un modifierait
          // l'autre.
          force_create_new_plan: true,
        },
      },
    });

    if (!configuration.purchase_url) {
      return { erreur: 'Le paiement n’a pas pu être ouvert. Réessayez dans un instant.' };
    }

    // Écrit avec la clé de service : la RLS ferme `orders` en écriture à tout
    // le monde sauf au staff, et c'est très bien ainsi — un client qui pourrait
    // insérer ses propres commandes pourrait s'en écrire une payée.
    await createServiceRoleClient()
      .from('orders')
      .insert({
        user_id: userId,
        formation_id: formation.id,
        montant_cents: montantCents,
        devise,
        statut: 'en_attente',
        provider: 'whop',
        provider_order_id: reference,
      });

    return { url: configuration.purchase_url };
  } catch {
    return { erreur: 'Le paiement n’a pas pu être ouvert. Réessayez dans un instant.' };
  }
}
