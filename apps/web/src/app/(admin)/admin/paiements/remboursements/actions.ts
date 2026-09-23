'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { centsVersDecimal } from '@/lib/paiement/montants-whop';
import { whopAppel } from '@/lib/whop';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';

/**
 * La réponse de `POST /payments/{id}/refund` : Whop rend le **paiement** mis à
 * jour, pas l'objet remboursement. L'identifiant qui nous intéresse est donc
 * dans son historique, et sa forme exacte n'a pas été vue en vrai.
 */
type ReponseRemboursement = {
  refunds?: Array<{ id?: unknown }> | null;
  refund?: { id?: unknown } | null;
  refund_id?: unknown;
};

/**
 * L'identifiant du remboursement qu'on vient de créer, ou `null`.
 *
 * Il sert à deux choses, et les deux comptent : il est écrit sur la ligne
 * `refunds`, et c'est par lui que le webhook `refund.created` reconnaîtra ce
 * remboursement comme venant du back-office plutôt que du tableau de bord
 * Whop. Sans lui, le même argent serait enregistré deux fois.
 *
 * L'endpoint de remboursement n'accepte pas de métadonnées — c'est ce qui
 * remplace le `metadata.refund_id` qu'on posait chez Stripe.
 */
function referenceDuRemboursement(reponse: ReponseRemboursement): string | null {
  const candidats = [
    // Le dernier de l'historique est celui qu'on vient de créer.
    reponse.refunds?.at(-1)?.id,
    reponse.refund?.id,
    reponse.refund_id,
  ];

  return candidats.find((c): c is string => typeof c === 'string' && c.length > 0) ?? null;
}

/**
 * Exécuter un remboursement chez le prestataire, puis l'enregistrer.
 *
 * **L'ordre n'est pas négociable : on appelle le prestataire d'abord, on
 * enregistre ensuite.** Un appel réseau ne peut pas tenir dans une transaction
 * de base. Enregistrer d'abord laisserait, en cas d'échec de l'appel, une ligne
 * « remboursée » sans argent rendu — un mensonge dans les comptes. Dans l'autre
 * sens, un échec d'enregistrement laisse de l'argent rendu sans trace, ce qui
 * se rattrape en relançant.
 *
 * **La protection contre le double remboursement est plus faible qu'avec
 * Stripe, et il faut le savoir.** Stripe garantissait par contrat qu'un appel
 * portant la même clé d'idempotence renvoie le même remboursement au lieu d'en
 * créer un second. La documentation de Whop mentionne cette clé dans un exemple
 * de SDK mais ne la décrit pas dans son schéma : on l'envoie, sans pouvoir s'y
 * fier. Ce qui reste : le contrôle sur `provider_refund_id` juste en dessous,
 * qui attrape le cas courant mais pas deux clics simultanés.
 *
 * **À vérifier dans le bac à sable Whop avant d'ouvrir les ventes** — c'est le
 * seul risque de cette bascule qui coûte de l'argent réel, et il se lève en un
 * appel répété (`docs/08-CE-QUI-MANQUE.md`).
 *
 * Le reste — commande passée en remboursée, inscription fermée, rôle Discord
 * retiré — se fait dans `enregistrer_remboursement()`, en une transaction.
 * Rembourser sans fermer l'accès, c'est offrir le produit.
 */
export async function traiterRemboursement(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const id = (donnees.get('refund_id') ?? '').toString();
  if (!id) return echoue('Remboursement introuvable.');

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return echoue('Session expirée.');

  // Lu sous RLS : `refunds_staff` réserve la table au staff.
  const { data: remboursement } = await supabase
    .from('refunds')
    .select(
      'id, montant_cents, statut, provider_refund_id, payments(provider, provider_payment_id)',
    )
    .eq('id', id)
    .maybeSingle();

  if (!remboursement) return echoue('Remboursement introuvable.');

  if (remboursement.provider_refund_id) {
    return echoue('Ce remboursement a déjà été exécuté.');
  }

  if (remboursement.statut === 'refuse') {
    return echoue('Ce remboursement a été refusé. Rouvre-le avant de l’exécuter.');
  }

  const paiement = remboursement.payments;

  if (!paiement?.provider_payment_id) {
    return echoue('Le paiement d’origine n’a pas de référence chez le prestataire.');
  }

  if (paiement.provider !== 'whop') {
    return echoue(
      'Ce paiement a été encaissé par un ancien prestataire. Il se rembourse depuis son ' +
        'tableau de bord, et le webhook l’enregistrera ici.',
    );
  }

  let referenceRemboursement: string;

  try {
    // Whop rembourse le paiement, pas une intention : il n'y a pas l'aller-
    // retour PaymentIntent → Charge → Invoice que Stripe imposait, et donc plus
    // le défaut qui faisait échouer tous les remboursements d'abonnement.
    //
    // Le montant repart en décimales, comme partout chez Whop. Omettre
    // `partial_amount` rembourserait l'intégralité : on le passe toujours, même
    // quand il vaut le montant complet, pour que l'écran décide et pas l'API.
    const reponse = await whopAppel<ReponseRemboursement>(
      `/payments/${encodeURIComponent(paiement.provider_payment_id)}/refund`,
      {
        methode: 'POST',
        corps: { partial_amount: centsVersDecimal(remboursement.montant_cents) },
        cleIdempotence: `refund-${remboursement.id}`,
      },
    );

    const reference = referenceDuRemboursement(reponse);

    // Sans l'identifiant rendu par Whop, on ne peut pas enregistrer la ligne :
    // en inventer un la rendrait introuvable, et le webhook `refund.created`
    // qui arrive derrière créerait un second remboursement pour le même argent.
    //
    // Ce n'est pas bloquant pour le client : l'argent est parti, et ce même
    // webhook appellera `enregistrer_remboursement_prestataire()`, qui retrouve
    // l'encaissement par ses références et referme l'accès s'il est soldé. On
    // le dit, plutôt que de faire croire que rien ne s'est passé.
    if (!reference) {
      await createServiceRoleClient()
        .from('refunds')
        .update({ erreur: 'Remboursement exécuté, identifiant Whop illisible dans la réponse.' })
        .eq('id', remboursement.id);

      return echoue(
        'Le remboursement est parti mais Whop n’a pas rendu d’identifiant. Il sera enregistré ' +
          'par le webhook — vérifie l’écran dans quelques minutes avant de relancer.',
      );
    }

    referenceRemboursement = reference;
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);

    // L'échec est consigné sur la ligne : sans ça, un remboursement qui ne
    // passe pas ressemble à un remboursement qu'on a oublié de lancer.
    await createServiceRoleClient()
      .from('refunds')
      .update({ erreur: message })
      .eq('id', remboursement.id);

    return echoue(`Le prestataire a refusé : ${message}`);
  }

  const { error } = await createServiceRoleClient().rpc('enregistrer_remboursement', {
    p_refund_id: remboursement.id,
    p_provider_refund_id: referenceRemboursement,
    p_traite_par: user.id,
  });

  if (error) {
    // L'argent est parti, l'enregistrement a échoué. Le webhook `refund.created`
    // arrive derrière et reconnaît ce remboursement par son identifiant, déjà
    // rendu par Whop : c'est lui qui rattrapera. Relancer à la main rembourserait
    // peut-être une seconde fois — la clé d'idempotence n'est pas garantie ici.
    return echoue(
      'Le remboursement a été exécuté chez le prestataire mais n’a pas pu être enregistré. ' +
        'Ne relance pas : le webhook doit l’enregistrer dans la minute. Vérifie l’écran, et ' +
        'si rien n’apparaît, passe par /admin/aide.',
    );
  }

  revalidatePath('/admin/paiements/remboursements');
  revalidatePath('/admin/paiements/transactions');

  return reussi('Remboursement exécuté et enregistré.');
}

/**
 * Enregistrer une demande de remboursement.
 *
 * Deux temps, et c'est volontaire pour de l'argent qui sort : on demande, puis
 * on exécute. Les colonnes `demande_par` et `traite_par` existent précisément
 * pour porter cette trace — savoir qui a demandé et qui a validé vaut mieux que
 * de découvrir un remboursement sans savoir d'où il vient.
 */
export async function demanderRemboursement(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const paymentId = (donnees.get('payment_id') ?? '').toString();
  const motif = (donnees.get('motif') ?? '').toString().trim();
  const montantSaisi = (donnees.get('montant_euros') ?? '').toString().trim().replace(',', '.');

  if (!paymentId) return echoue('Paiement introuvable.');
  if (!motif) return echoue('Un motif est nécessaire.');

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return echoue('Session expirée.');

  const { data: paiement } = await supabase
    .from('payments')
    .select('id, montant_cents, statut')
    .eq('id', paymentId)
    .maybeSingle();

  if (!paiement) return echoue('Paiement introuvable.');

  if (paiement.statut !== 'reussi') {
    return echoue('Seul un paiement encaissé peut être remboursé.');
  }

  const montantCents = montantSaisi
    ? Math.round(Number(montantSaisi) * 100)
    : paiement.montant_cents;

  if (!Number.isFinite(montantCents) || montantCents <= 0) {
    return echoue('Le montant n’est pas valide.');
  }

  // Rembourser plus que ce qui a été encaissé n'a pas de sens, et Stripe le
  // refuserait de toute façon — autant le dire ici.
  if (montantCents > paiement.montant_cents) {
    return echoue('Le montant dépasse ce qui a été encaissé.');
  }

  const { error } = await supabase.from('refunds').insert({
    payment_id: paiement.id,
    montant_cents: montantCents,
    motif,
    statut: 'demande',
    demande_par: user.id,
  });

  if (error) {
    return echoue('L’enregistrement a échoué. Réessaie dans un instant.');
  }

  revalidatePath('/admin/paiements/remboursements');

  return reussi('Demande de remboursement enregistrée.');
}
