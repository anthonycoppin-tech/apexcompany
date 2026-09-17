/**
 * Les valeurs de paiement, dites en français — pour les écrans comme pour les
 * exports, qui doivent dire la même chose.
 */

export const PRESTATAIRES: Record<string, string> = { stripe: 'Stripe', paypal: 'PayPal' };

/** Les moyens que Stripe renvoie dans `payment_method_types`. */
export const METHODES: Record<string, string> = {
  card: 'carte',
  sepa_debit: 'prélèvement SEPA',
  paypal: 'PayPal',
  link: 'Link',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
};

export const STATUTS_PAIEMENT: Record<string, string> = {
  en_attente: 'En attente',
  reussi: 'Encaissé',
  echoue: 'Échoué',
  rembourse: 'Remboursé',
};

export const STATUTS_REMBOURSEMENT: Record<string, string> = {
  demande: 'Demandé',
  approuve: 'Approuvé',
  refuse: 'Refusé',
  traite: 'Exécuté',
};
