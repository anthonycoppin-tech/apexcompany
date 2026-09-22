import { VERSION_TEXTES_LEGAUX } from './societe.ts';

/**
 * Les deux cases à cocher avant de payer, et la version enregistrée avec elles.
 *
 * Les CGV reprises de l'ancien site affirment que le client les accepte « en
 * cochant la case dédiée » et renonce à sa rétractation de la même façon. Aucun
 * des deux parcours de paiement ne présentait la moindre case : les CGV
 * décrivaient un geste que le site ne faisait pas faire, donc une acceptation
 * impossible à prouver — et, pour la rétractation, un droit qui ne s'éteint
 * jamais faute de demande expresse.
 *
 * **Deux cases, pas une.** Accepter des conditions et demander à renoncer à un
 * droit sont deux consentements distincts ; les fondre dans une seule case,
 * c'est se voir opposer que le second n'a jamais été donné.
 *
 * Le texte de la seconde dépend du produit, parce que la règle en dépend. Une
 * formation et un abonnement ouvrent un accès à des contenus : la rétractation
 * s'éteint à l'accès. Un abonnement se résilie, il ne se rembourse pas — le
 * client garde son accès jusqu'à la fin de la période payée (décidé le
 * 22 septembre 2026). Un accompagnement est un suivi par un formateur, donc un
 * service : le client peut encore le quitter en payant la part fournie.
 * Article 8 des CGV.
 *
 * Ce module est lu par le formulaire (navigateur) et par l'action (serveur) :
 * les libellés affichés et la version enregistrée ne peuvent pas diverger.
 */
export const CHAMP_CGV = 'accepte_cgv';
export const CHAMP_DEMARRAGE = 'demarrage_immediat';

/** Formation et abonnement : la rétractation s'éteint à l'accès. */
export function renonceALAcces(typeProduit: string): boolean {
  return typeProduit !== 'accompagnement';
}

export function texteDemarrage(typeProduit: string): string {
  return renonceALAcces(typeProduit)
    ? 'Je demande l’accès immédiat et je reconnais perdre mon droit de rétractation dès que cet accès est ouvert.'
    : 'Je demande que mon accès commence immédiatement, avant la fin du délai de rétractation de quatorze jours. Si je me rétracte dans ce délai, la part correspondant à la période écoulée reste due.';
}

/**
 * Ce qui est enregistré dans `consents.version_texte` : de quoi retrouver,
 * pour une vente, les textes exacts acceptés — la date désigne la version des
 * CGV et de l'avertissement dans git, le suffixe la variante de la seconde case.
 */
export function versionAcceptation(typeProduit: string): string {
  const demarrage = renonceALAcces(typeProduit) ? 'renonciation' : 'prorata';
  return `cgv+avertissement:${VERSION_TEXTES_LEGAUX};demarrage-immediat:${demarrage}`;
}

/** `null` si les deux cases sont cochées, le message à afficher sinon. */
export function acceptationManquante(donnees: FormData): string | null {
  if (donnees.get(CHAMP_CGV) !== 'on') {
    return 'Merci d’accepter les conditions générales de vente et l’avertissement sur les risques.';
  }
  if (donnees.get(CHAMP_DEMARRAGE) !== 'on') {
    return 'Merci de confirmer que votre accès commence immédiatement.';
  }
  return null;
}
