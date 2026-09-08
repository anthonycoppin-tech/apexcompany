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
 * L'éligibilité du prospect — **il n'y a pas de règle, et c'est la réponse**.
 *
 * Tranché par le chef de projet le 8 septembre 2026 : le « ton profil est
 * éligible » affiché par le formulaire Tally en production n'est adossé à aucun
 * filtrage réel. Tout prospect qui soumet le formulaire est éligible.
 *
 * Cette fonction renvoie donc `true`, et non plus `null`. La nuance compte :
 * `null` voulait dire « pas encore évalué », c'est-à-dire une case à traiter
 * plus tard, dans le CRM comme dans les statistiques. `true` dit que
 * l'évaluation a eu lieu et qu'elle est positive. Laisser `null` par prudence
 * aurait produit un pipeline entier de prospects en attente d'un arbitrage qui
 * n'existe pas.
 *
 * Deux choses que cette décision ne change pas :
 *
 * - **Le refus des moins de 18 ans reste entier.** C'est un refus dur, et il
 *   intervient avant toute écriture en base — un mineur ne devient jamais un
 *   lead. Il ne passe pas par ici (voir `questionnaire.ts`).
 * - **Le tunnel n'a aucune branche « non éligible » à construire.** Il n'y a
 *   pas d'écran de refus à écrire, pas de message à rédiger.
 *
 * Le fichier survit malgré son corps d'une ligne, et c'est délibéré : le jour
 * où une règle apparaît — un budget plancher, une zone géographique exclue pour
 * des raisons fiscales — elle se pose ici, à un seul endroit, testable, au lieu
 * de se disséminer dans le composant et dans l'action.
 */
export function evaluerEligibilite(reponses: ReponsesQualification): boolean {
  void reponses;
  return true;
}
