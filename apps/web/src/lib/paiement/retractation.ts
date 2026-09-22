/**
 * Le montant d'une rétractation d'accompagnement, article 8 des CGV.
 *
 * Seul l'accompagnement se rétracte au prorata : la formation et l'abonnement
 * perdent le droit à l'accès (décidé le 22 septembre 2026). La règle publiée est
 * « prix payé × jours écoulés ÷ jours de la période achetée », avec l'exemple
 * de `/remboursement` — 900 € pour 90 jours, rétractation au 6ᵉ jour, 60 €
 * retenus. Le jour du début compte donc pour le premier.
 *
 * Le calcul est ici, et non de tête dans le back-office, parce qu'un montant
 * de remboursement faux dans un sens est de l'argent perdu, et dans l'autre un
 * litige avec un consommateur à qui l'on a publié la formule.
 *
 * **Le remboursement lancé depuis le back-office referme l'accès**, partiel ou
 * non (`enregistrer_remboursement()`) : il n'y a rien d'autre à faire après.
 *
 * Fonction pure, en dates `AAAA-MM-JJ` : pas de fuseau à deviner, l'appelant
 * donne la date du jour à Paris.
 */
export const DELAI_RETRACTATION_JOURS = 14;

const JOUR = 86_400_000;
const jours = (de: string, a: string) =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / JOUR);

export type Retractation = {
  /** Dernier jour pour se rétracter, inclus. */
  limite: string;
  joursEcoules: number;
  joursTotal: number;
  retenuCents: number;
  rembourseCents: number;
};

/**
 * `null` quand la rétractation au prorata ne s'applique pas : autre type de
 * produit, délai dépassé, ou dates incohérentes. Jamais un montant approximatif.
 */
export function retractationAccompagnement({
  typeProduit,
  montantCents,
  payeLe,
  debut,
  fin,
  aujourdhui,
}: {
  typeProduit: string;
  montantCents: number;
  /** Date du paiement, `AAAA-MM-JJ` à Paris : c'est lui qui ouvre le délai. */
  payeLe: string;
  debut: string;
  fin: string | null;
  aujourdhui: string;
}): Retractation | null {
  if (typeProduit !== 'accompagnement' || !fin) return null;

  const limite = new Date(Date.parse(`${payeLe}T00:00:00Z`) + DELAI_RETRACTATION_JOURS * JOUR)
    .toISOString()
    .slice(0, 10);
  if (aujourdhui > limite || aujourdhui < debut) return null;

  const joursTotal = jours(debut, fin);
  if (joursTotal <= 0) return null;

  const joursEcoules = Math.min(jours(debut, aujourdhui) + 1, joursTotal);
  // Entier, en centimes — jamais de flottant pour de l'argent. L'arrondi se
  // fait sur la part retenue, le remboursement en est le complément exact.
  const retenuCents = Math.round((montantCents * joursEcoules) / joursTotal);

  return {
    limite,
    joursEcoules,
    joursTotal,
    retenuCents,
    rembourseCents: montantCents - retenuCents,
  };
}
