import type { Database } from '@apex/db';

type Enums = Database['public']['Enums'];

export type ReponsesQualification = {
  zone_geo: Enums['zone_geo'];
  tranche_age: Enums['tranche_age'];
  situation_pro: Enums['situation_pro'];
  niveau_trading: Enums['niveau_trading'];
  prop_firm: Enums['prop_firm_statut'];
  blocage: Enums['blocage_trading'];
  tranche_budget: Enums['tranche_budget'];
  delai_objectif: Enums['delai_objectif'];
};

/**
 * L'éligibilité du prospect — **la règle n'est pas connue**.
 *
 * Le formulaire Tally en production affiche « ton profil est éligible » à la
 * fin, donc une règle existe déjà quelque part. Laquelle, et ce qu'on affiche à
 * quelqu'un qui n'est pas éligible, sont le point ouvert §8.1 du cahier des
 * charges, et le plus urgent des points restants.
 *
 * En attendant, cette fonction renvoie `null`, qui veut dire « pas encore
 * évalué » — exactement ce que `leads.eligible` accepte, et ce qu'un lead
 * saisi à la main porte aussi.
 *
 * Deux choses volontaires ici. D'abord, ce fichier existe déjà, vide de règle :
 * le jour où la réponse arrive, elle se pose à un seul endroit, testable, au
 * lieu de se disséminer dans le composant et dans l'action. Ensuite, on ne
 * devine pas : inventer un seuil de budget « raisonnable » en attendant, c'est
 * refuser des gens en silence sur un critère que personne n'a validé, et le
 * découvrir six mois plus tard dans les statistiques de conversion.
 *
 * Ce qui est déjà décidé et ne dépend pas de cette fonction : le refus des
 * moins de 18 ans, qui est un refus dur intervenant AVANT toute écriture en
 * base (voir `questionnaire.ts`). Il n'a rien à faire ici.
 */
// La signature est déjà celle qu'aura la règle ; seul son corps attend la
// réponse du client. Le paramètre reste donc nommé et documenté.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function evaluerEligibilite(reponses: ReponsesQualification): boolean | null {
  return null;
}
