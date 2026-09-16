'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { stripe } from '@/lib/stripe';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';

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
    return echoue('Cet abonnement n’existe pas ou ne t’appartient pas.');
  }

  if (abonnement.statut === 'resiliee' || abonnement.statut === 'terminee') {
    return echoue('Cet abonnement est déjà résilié.');
  }

  try {
    await stripe().subscriptions.update(abonnement.provider_subscription_id, {
      cancel_at_period_end: true,
    });
  } catch {
    return echoue('La résiliation n’a pas pu être enregistrée. Réessaie dans un instant.');
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
