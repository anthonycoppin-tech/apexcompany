'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { stripe } from '@/lib/stripe';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';

/**
 * Exécuter un remboursement chez le prestataire, puis l'enregistrer.
 *
 * **L'ordre n'est pas négociable : on appelle Stripe d'abord, on enregistre
 * ensuite.** Un appel réseau ne peut pas tenir dans une transaction de base.
 * Enregistrer d'abord laisserait, en cas d'échec de l'appel, une ligne
 * « remboursée » sans argent rendu — un mensonge dans les comptes. Dans l'autre
 * sens, un échec d'enregistrement laisse de l'argent rendu sans trace, ce qui
 * se rattrape en relançant.
 *
 * **Et relancer est sans danger**, parce que l'identifiant de la ligne `refunds`
 * sert de clé d'idempotence chez Stripe : un appel rejoué renvoie le même
 * remboursement au lieu d'en créer un second. C'est la garantie réelle ; le
 * contrôle sur `provider_refund_id` juste en dessous n'est que la première
 * barrière, celle qui évite l'aller-retour inutile.
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

  if (paiement.provider !== 'stripe') {
    return echoue('Seuls les paiements Stripe se remboursent depuis ici pour l’instant.');
  }

  let referenceStripe: string;

  try {
    const refund = await stripe().refunds.create(
      {
        payment_intent: paiement.provider_payment_id,
        amount: remboursement.montant_cents,
      },
      // La clé d'idempotence, et c'est elle qui empêche de rembourser deux fois.
      // L'identifiant de la ligne est stable et unique : un rejeu renvoie le
      // même remboursement.
      { idempotencyKey: `refund-${remboursement.id}` },
    );

    referenceStripe = refund.id;
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
    p_provider_refund_id: referenceStripe,
    p_traite_par: user.id,
  });

  if (error) {
    // L'argent est parti, l'enregistrement a échoué. Relancer est sans danger :
    // la clé d'idempotence renverra le même remboursement chez Stripe.
    return echoue(
      'Le remboursement a été exécuté chez le prestataire mais n’a pas pu être enregistré. Relance : l’opération ne sera pas refaite deux fois.',
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
