import 'server-only';

import type Stripe from 'stripe';

/**
 * Le pont entre les identifiants de Stripe et `payments.provider_payment_id`.
 *
 * Un paiement n'est pas enregistré sous le même identifiant selon son origine :
 * l'intention de paiement (`pi_`) pour un achat unique, la facture (`in_`) pour
 * un abonnement — premier mois comme renouvellements. Les litiges et les
 * remboursements, eux, arrivent avec une intention de paiement et une charge.
 * Ces deux fonctions font la traduction dans chaque sens, pour qu'aucun
 * appelant n'ait à connaître la règle.
 */

const idDe = (x: string | { id?: string } | null | undefined): string | null =>
  typeof x === 'string' ? x : (x?.id ?? null);

/**
 * Toutes les références sous lesquelles ce paiement peut être enregistré chez
 * nous. La base prend celle qu'elle connaît (`enregistrer_litige()`,
 * `enregistrer_remboursement_prestataire()`).
 */
export async function referencesDuPaiement(
  client: Stripe,
  intention: string | null,
  charge: string | null,
): Promise<string[]> {
  const references = new Set<string>();
  if (intention) references.add(intention);
  if (charge) references.add(charge);

  if (intention) {
    // Un achat unique n'a pas de facture Stripe : la liste revient vide, et
    // c'est l'intention elle-même qui correspond.
    const paiements = await client.invoicePayments.list({
      payment: { type: 'payment_intent', payment_intent: intention },
      limit: 10,
    });
    for (const p of paiements.data) {
      const facture = idDe(p.invoice);
      if (facture) references.add(facture);
    }
  }

  return [...references];
}

/**
 * L'intention de paiement d'un paiement enregistré, quel que soit
 * l'identifiant sous lequel il l'a été — c'est ce que l'API de remboursement
 * demande. `cs_` couvre les paiements d'abonnement enregistrés avant le
 * 18 septembre, sous l'identifiant de la session de paiement.
 */
export async function intentionDuPaiement(
  client: Stripe,
  reference: string,
): Promise<string | null> {
  if (reference.startsWith('pi_')) return reference;

  if (reference.startsWith('in_')) {
    const paiements = await client.invoicePayments.list({ invoice: reference, limit: 10 });
    const paye = paiements.data.find((p) => p.status === 'paid') ?? paiements.data[0];
    return idDe(paye?.payment.payment_intent);
  }

  if (reference.startsWith('cs_')) {
    const session = await client.checkout.sessions.retrieve(reference);
    const intention = idDe(session.payment_intent);
    if (intention) return intention;
    const facture = idDe(session.invoice);
    return facture ? intentionDuPaiement(client, facture) : null;
  }

  return null;
}
