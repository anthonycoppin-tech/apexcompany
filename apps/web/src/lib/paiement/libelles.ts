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

/**
 * Une durée d'accès, dite comme le client la vend.
 *
 * La base compte en jours (`formations.duree_acces_jours`), et c'est juste :
 * `traiter_paiement()` fait `current_date + duree_acces_jours`, une arithmétique
 * de dates sans ambiguïté. Mais le catalogue se vend en mois — « PALACE 2,
 * deux mois » —, et afficher « 60 jours » sur la fiche oblige le visiteur à
 * faire la conversion lui-même au moment précis où il compare deux offres.
 *
 * La conversion ne s'applique qu'aux multiples exacts de trente : le reste
 * s'affiche en jours plutôt que d'arrondir un mois et demi à deux mois.
 *
 * **Ce n'est qu'un libellé.** L'accès réel reste de 180 jours, pas de six mois
 * calendaires — c'est un écart d'un à quatre jours selon la date d'achat, assumé
 * depuis l'origine du modèle et sans conséquence pour le client, qui y gagne
 * plus souvent qu'il n'y perd.
 */
export function dureeAcces(jours: number): string {
  if (jours % 30 !== 0) return jours === 1 ? '1 jour' : `${jours} jours`;

  const mois = jours / 30;
  return mois === 1 ? '1 mois' : `${mois} mois`;
}

/**
 * Le suffixe de prix d'un abonnement : « / mois », « / an ».
 *
 * **C'est le libellé dont l'erreur coûte le plus cher** : afficher « 490 € /
 * mois » sur un abonnement annuel, ou l'inverse, c'est une promesse de prix
 * fausse d'un facteur douze. Il se dérive donc de la période du produit, qui
 * est aussi celle que le prestataire prélève et celle dont l'accès est ouvert —
 * une seule valeur, trois usages.
 */
export function periodiciteAbonnement(jours: number | null): string {
  if (jours === null) return '';
  if (jours === 30) return '/ mois';
  if (jours === 365) return '/ an';
  return `/ ${dureeAcces(jours)}`;
}

/** Le nom du type d'abonnement, pour les endroits qui le nomment en toutes lettres. */
export function libelleAbonnement(jours: number | null): string {
  if (jours === 30) return 'Abonnement mensuel';
  if (jours === 365) return 'Abonnement annuel';
  return 'Abonnement';
}
