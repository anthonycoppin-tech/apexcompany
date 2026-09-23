/**
 * Les valeurs de paiement, dites en français — pour les écrans comme pour les
 * exports, qui doivent dire la même chose.
 */

export const PRESTATAIRES: Record<string, string> = {
  whop: 'Whop',
  // Gardés parce que des encaissements passés les portent : un libellé retiré
  // ferait afficher le code brut sur d'anciennes lignes, pas un écran vide.
  stripe: 'Stripe',
  paypal: 'PayPal',
};

/** Les moyens de paiement, tels que les prestataires les nomment. */
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
