'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { stripe } from '@/lib/stripe';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';
import { urlSite } from '@/lib/site';

/**
 * Résilier son abonnement, depuis son espace.
 *
 * **Un abonnement qu'on ne peut annuler que par email est une source de litige,
 * et selon les cas une non-conformité.** D'où ce bouton, qui n'est pas un
 * confort d'interface.
 *
 * La résiliation est **à effet différé** : `cancel_at_period_end` chez Stripe,
 * et rien n'est coupé ici. L'accès court jusqu'à la fin du mois déjà payé, et
 * c'est la révocation quotidienne qui le referme le moment venu. Couper tout de
 * suite reviendrait à ne pas rendre le mois encaissé.
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

  try {
    await stripe().subscriptions.update(abonnement.provider_subscription_id, {
      cancel_at_period_end: true,
    });
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
 * faire : l'abonnement mourait au bout des relances de Stripe, faute d'une
 * carte à jour. On ouvre le portail client de Stripe directement sur la mise à
 * jour du moyen de paiement. Stripe retente la facture en échec avec la nouvelle
 * carte à sa prochaine tentative (pas forcément à l'instant), et `invoice.paid`
 * fait le reste.
 *
 * Le portail plutôt qu'un formulaire de carte ici : aucune donnée de carte ne
 * transite par le site, donc rien à sécuriser de notre côté. Il demande en
 * revanche d'avoir enregistré une fois sa configuration dans le tableau de bord
 * Stripe (`docs/08-CE-QUI-MANQUE.md`) — sans elle, l'appel échoue et le message
 * ci-dessous s'affiche.
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

  if (!abonnement || abonnement.provider !== 'stripe') {
    return echoue('Cet abonnement n’existe pas ou ne vous appartient pas.');
  }

  let lien: string;
  try {
    const client = stripe();
    const souscription = await client.subscriptions.retrieve(abonnement.provider_subscription_id);
    const session = await client.billingPortal.sessions.create({
      customer:
        typeof souscription.customer === 'string'
          ? souscription.customer
          : souscription.customer.id,
      return_url: `${urlSite}/espace/factures`,
      flow_data: {
        type: 'payment_method_update',
        after_completion: {
          type: 'redirect',
          redirect: { return_url: `${urlSite}/espace/factures` },
        },
      },
    });
    lien = session.url;
  } catch {
    return echoue(
      'La page de paiement n’a pas pu s’ouvrir. Réessayez dans un instant, ou écrivez-nous.',
    );
  }

  // Hors du `try` : `redirect` lève une exception que Next.js intercepte, et
  // un `catch` l'aurait prise pour un échec.
  redirect(lien);
}
