import { decimalVersCents } from './montants-whop.ts';

/**
 * La TVA calculée par Whop, lue dans les paiements du webhook.
 *
 * **Une TVA qu'on n'a pas calculée n'est pas une TVA nulle.** C'était déjà la
 * règle avec Stripe Tax et elle compte davantage ici : le mode fiscal du compte
 * Whop décide qui collecte, et tant que personne ne l'a confirmé, un
 * `tax_amount` absent veut dire « on ne sait pas », jamais « 0 € de TVA ».
 * L'écrire comme un zéro ferait affirmer à la facture « TVA 0 % » pour un
 * encaissement dont personne n'a évalué la TVA.
 *
 * Un zéro **explicitement calculé**, lui, se garde : c'est une information,
 * pas une absence.
 *
 * Types structurels plutôt que ceux d'un SDK : cette fonction ne lit que trois
 * champs, et reste testable avec des objets écrits à la main.
 */
export type Taxe = { tvaCents: number | null; pays: string | null };

const INCONNUE: Taxe = { tvaCents: null, pays: null };

const pays = (code: unknown) =>
  typeof code === 'string' && /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : null;

export type PaiementWhop = {
  tax_amount?: unknown;
  billing_address?: { country?: unknown } | null;
  shipping_address?: { country?: unknown } | null;
};

/**
 * La TVA d'un paiement Whop — premier encaissement comme renouvellement.
 *
 * Une seule fonction là où Stripe en demandait deux : Whop expose la même
 * forme de paiement dans les deux cas, ce qui retire au passage la classe de
 * défaut où l'une des deux lectures oubliait un champ que l'autre avait.
 *
 * Le pays vient de l'adresse de facturation, jamais de livraison : il n'y a
 * rien à livrer, et c'est l'adresse de facturation qui détermine la TVA.
 */
export function taxeDePaiement(paiement: PaiementWhop): Taxe {
  const tvaCents = decimalVersCents(paiement.tax_amount);
  if (tvaCents === null) return INCONNUE;

  return { tvaCents, pays: pays(paiement.billing_address?.country) };
}
