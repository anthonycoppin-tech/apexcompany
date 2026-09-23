'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { whopAppel } from '@/lib/whop';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';

/**
 * Résilier son abonnement, depuis son espace.
 *
 * **Un abonnement qu'on ne peut annuler que par email est une source de litige,
 * et selon les cas une non-conformité.** D'où ce bouton, qui n'est pas un
 * confort d'interface.
 *
 * La résiliation est **à effet différé** : on demande à Whop de ne plus
 * renouveler, et rien n'est coupé ici. L'accès court jusqu'à la fin du mois
 * déjà payé, et c'est la révocation quotidienne qui le referme le moment venu.
 * Couper tout de suite reviendrait à ne pas rendre le mois encaissé.
 *
 * **Et c'est vrai même si Whop se trompe.** Le nom exact du paramètre de
 * `/memberships/{id}/cancel` n'est pas documenté ; s'il était ignoré et que
 * Whop éteignait l'adhésion sur-le-champ, le client ne perdrait quand même
 * rien : l'accès du site et le rôle Discord sont pilotés par
 * `inscriptions.date_fin_acces`, pas par l'état de l'adhésion chez le
 * prestataire. C'est le bénéfice concret d'avoir gardé la maîtrise de l'accès
 * au lieu de la déléguer à l'encaisseur — un arbitrage qui paraissait
 * théorique le 23 septembre et qui se paie ici.
 *
 * L'appartenance est vérifiée par la RLS, en relisant l'abonnement avec le
 * client à session : un identifiant venu du navigateur ne donne accès qu'à ce
 * que les politiques laissent lire.
 */
export async function resilierAbonnement(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const id = (donnees.get('subscription_id') ?? '').toString();
  if (!id) return echoue('Abonnement introuvable.');

  const supabase = await createClient();

  const { data: abonnement } = await supabase
    .from('subscriptions')
    .select('id, statut, provider, provider_subscription_id')
    .eq('id', id)
    .maybeSingle();

  if (!abonnement) {
    return echoue('Cet abonnement n’existe pas ou ne vous appartient pas.');
  }

  if (abonnement.statut === 'resiliee' || abonnement.statut === 'terminee') {
    return echoue('Cet abonnement est déjà résilié.');
  }

  if (abonnement.provider !== 'whop') {
    return echoue(
      'Cet abonnement a été souscrit chez un ancien prestataire. Écrivez-nous et nous le ' +
        'résilions pour vous.',
    );
  }

  try {
    await whopAppel(
      `/memberships/${encodeURIComponent(abonnement.provider_subscription_id)}/cancel`,
      { methode: 'POST', corps: { cancel_at_period_end: true } },
    );
  } catch {
    return echoue('La résiliation n’a pas pu être enregistrée. Réessayez dans un instant.');
  }

  // Écrit avec la clé de service : `subscriptions` est en lecture seule pour le
  // client, et doit le rester — un client qui pourrait écrire dans cette table
  // pourrait repousser sa propre date de fin.
  //
  // Le statut passe à `resiliee` dès maintenant pour que l'écran dise la vérité,
  // mais `date_fin_acces` n'est pas touchée : l'accès reste ouvert jusqu'au
  // terme payé.
  await createServiceRoleClient()
    .from('subscriptions')
    .update({ statut: 'resiliee', resiliation_demandee_le: new Date().toISOString() })
    .eq('id', abonnement.id);

  revalidatePath('/espace/factures');
  revalidatePath('/espace');

  return reussi('Résiliation enregistrée.');
}

/**
 * Changer de carte après un prélèvement en échec.
 *
 * L'écran disait « vérifiez votre moyen de paiement » sans aucun moyen de le
 * faire : l'abonnement mourait au bout des relances du prestataire, faute d'une
 * carte à jour. On envoie donc le client sur le portail que Whop tient pour
 * chaque adhésion — il y change sa carte, consulte son historique et peut
 * résilier. Le prélèvement en échec est retenté avec la nouvelle carte à la
 * tentative suivante (pas forcément à l'instant), et `payment.succeeded` fait
 * le reste.
 *
 * Le portail plutôt qu'un formulaire de carte ici : aucune donnée de carte ne
 * transite par le site, donc rien à sécuriser de notre côté.
 *
 * **Le lien se lit sur l'adhésion, il ne se fabrique pas.** Whop pose un
 * `manage_url` propre à chaque adhésion ; l'écrire à la main à partir d'un
 * identifiant produirait une URL plausible qui mènerait ailleurs — ou nulle
 * part. On le lit, et s'il n'y est pas on le dit.
 */
export async function ouvrirMiseAJourCarte(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const id = (donnees.get('subscription_id') ?? '').toString();
  if (!id) return echoue('Abonnement introuvable.');

  // Relu sous RLS, comme la résiliation : l'identifiant vient du navigateur.
  const { data: abonnement } = await (
    await createClient()
  )
    .from('subscriptions')
    .select('id, provider, provider_subscription_id')
    .eq('id', id)
    .maybeSingle();

  if (!abonnement || abonnement.provider !== 'whop') {
    return echoue('Cet abonnement n’existe pas ou ne vous appartient pas.');
  }

  let lien: string;
  try {
    const adhesion = await whopAppel<{ manage_url?: unknown }>(
      `/memberships/${encodeURIComponent(abonnement.provider_subscription_id)}`,
    );

    if (typeof adhesion.manage_url !== 'string' || !adhesion.manage_url) {
      throw new Error('Adhésion sans lien de gestion.');
    }

    lien = adhesion.manage_url;
  } catch {
    return echoue(
      'La page de paiement n’a pas pu s’ouvrir. Réessayez dans un instant, ou écrivez-nous.',
    );
  }

  // Hors du `try` : `redirect` lève une exception que Next.js intercepte, et
  // un `catch` l'aurait prise pour un échec.
  redirect(lien);
}
