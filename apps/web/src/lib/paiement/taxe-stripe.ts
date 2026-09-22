/**
 * La TVA calculée par Stripe Tax, lue dans les événements du webhook.
 *
 * **Une TVA qu'on n'a pas calculée n'est pas une TVA nulle.** Si le calcul
 * automatique n'était pas actif pour ce paiement — une session ouverte avant
 * Stripe Tax, un prélèvement d'abonnement créé avant — Stripe renvoie quand même
 * `amount_tax: 0`. L'écrire tel quel ferait affirmer à la facture « TVA 0 % »
 * pour un encaissement dont personne n'a évalué la TVA. On rend `null`, et la
 * facture le dit.
 *
 * Types structurels plutôt que ceux du SDK : ces fonctions ne lisent que
 * quelques champs, et restent testables avec des objets écrits à la main.
 */
export type Taxe = { tvaCents: number | null; pays: string | null };

const INCONNUE: Taxe = { tvaCents: null, pays: null };

const pays = (code: string | null | undefined) =>
  code && /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : null;

/** `checkout.session.completed` : l'achat unique, ou le premier mois d'un abonnement. */
export function taxeDeSession(session: {
  automatic_tax?: { enabled?: boolean | null; status?: string | null } | null;
  total_details?: { amount_tax?: number | null } | null;
  customer_details?: { address?: { country?: string | null } | null } | null;
}): Taxe {
  if (!session.automatic_tax?.enabled || session.automatic_tax.status !== 'complete') {
    return INCONNUE;
  }
  return {
    tvaCents: session.total_details?.amount_tax ?? null,
    pays: pays(session.customer_details?.address?.country),
  };
}

/** `invoice.paid` : un prélèvement mensuel d'abonnement. */
export function taxeDeFacture(facture: {
  automatic_tax?: { enabled?: boolean | null; status?: string | null } | null;
  total_taxes?: Array<{ amount: number }> | null;
  customer_address?: { country?: string | null } | null;
}): Taxe {
  if (!facture.automatic_tax?.enabled || facture.automatic_tax.status !== 'complete') {
    return INCONNUE;
  }
  return {
    tvaCents: (facture.total_taxes ?? []).reduce((total, t) => total + t.amount, 0),
    pays: pays(facture.customer_address?.country),
  };
}
