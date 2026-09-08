import type { Database } from '@apex/db';

type Enums = Database['public']['Enums'];

/**
 * Le formulaire de qualification, décrit une seule fois.
 *
 * L'écran et la validation serveur lisent le MÊME objet. Un formulaire dont les
 * options vivent dans le JSX et se revalident à la main dans l'action finit
 * toujours par diverger, et c'est la validation qui perd — donc la porte
 * d'entrée du tunnel qui laisse passer une valeur que la base refusera.
 *
 * Le relevé fait foi : `docs/01-CAHIER-DES-CHARGES.md` §9, annexe. Toutes les
 * questions sont obligatoires.
 */

export type Choix<T extends string> = { readonly valeur: T; readonly libelle: string };

const options = <T extends string>(...c: ReadonlyArray<Choix<T>>) => c;

export const ZONES_GEO = options<Enums['zone_geo']>(
  { valeur: 'europe', libelle: 'Europe' },
  { valeur: 'amerique', libelle: 'Amérique' },
  { valeur: 'asie', libelle: 'Asie' },
  { valeur: 'oceanie', libelle: 'Océanie' },
  { valeur: 'afrique', libelle: 'Afrique' },
);

/**
 * `moins_18` n'existe pas dans l'énumération `tranche_age` en base, et c'est
 * volontaire : un mineur est refusé avant toute écriture, il ne devient jamais
 * un lead. La valeur existe donc ici, dans la saisie, et nulle part ailleurs.
 */
export const MOINS_18 = 'moins_18' as const;
export type TrancheAgeSaisie = Enums['tranche_age'] | typeof MOINS_18;

export const TRANCHES_AGE = options<TrancheAgeSaisie>(
  { valeur: MOINS_18, libelle: 'Moins de 18 ans' },
  { valeur: '18_25', libelle: '18 – 25 ans' },
  { valeur: '25_35', libelle: '25 – 35 ans' },
  { valeur: '35_50', libelle: '35 – 50 ans' },
  { valeur: 'plus_50', libelle: 'Plus de 50 ans' },
);

export const SITUATIONS_PRO = options<Enums['situation_pro']>(
  { valeur: 'salarie', libelle: 'Salarié' },
  { valeur: 'independant', libelle: "Indépendant / Chef d'entreprise" },
  { valeur: 'etudiant', libelle: 'Étudiant / Alternant / CDD / Intérim' },
  { valeur: 'sans_emploi', libelle: 'Sans emploi' },
);

export const NIVEAUX_TRADING = options<Enums['niveau_trading']>(
  { valeur: 'decouverte', libelle: 'Je découvre, je ne me suis jamais lancé' },
  { valeur: 'debutant', libelle: "Débutant, j'ai déjà passé quelques trades" },
  { valeur: 'intermediaire', libelle: 'Intermédiaire' },
  { valeur: 'avance', libelle: 'Avancé, plus de 2 ans' },
);

export const PROP_FIRM = options<Enums['prop_firm_statut']>(
  { valeur: 'non', libelle: 'Non' },
  { valeur: 'en_challenge', libelle: 'En cours de challenge' },
  { valeur: 'oui', libelle: 'Oui' },
);

export const BLOCAGES = options<Enums['blocage_trading']>(
  { valeur: 'strategie', libelle: 'Stratégie — quand entrer, quand sortir' },
  { valeur: 'discipline', libelle: 'Discipline et psychologie — le plan n’est pas respecté' },
  {
    valeur: 'gestion_risque',
    libelle: 'Gestion du risque — drawdown, taille de position, pertes',
  },
  { valeur: 'prop_firm', libelle: 'Réussir une prop firm' },
);

export const TRANCHES_BUDGET = options<Enums['tranche_budget']>(
  { valeur: '500_1000', libelle: '500 – 1 000 €' },
  { valeur: '1000_2000', libelle: '1 000 – 2 000 €' },
  { valeur: '2000_5000', libelle: '2 000 – 5 000 €' },
  { valeur: 'plus_5000', libelle: 'Plus de 5 000 €' },
);

export const DELAIS_OBJECTIF = options<Enums['delai_objectif']>(
  { valeur: 'immediat', libelle: 'Le plus rapidement possible' },
  { valeur: 'mois_prochain', libelle: "D'ici le mois prochain" },
  { valeur: 'trois_mois', libelle: 'Dans les 3 prochains mois' },
);

/** Version du texte de consentement, enregistrée avec lui dans `consents`. */
export const VERSION_CONSENTEMENT = '2026-09-v1';

export type ChampTexte = {
  readonly type: 'texte' | 'email' | 'tel';
  readonly champ: 'prenom' | 'email' | 'telephone';
  readonly libelle: string;
};

export type ChampChoix = {
  readonly type: 'choix';
  readonly champ: string;
  readonly libelle: string;
  readonly options: ReadonlyArray<Choix<string>>;
};

export type Question = ChampTexte | ChampChoix;

export type Ecran = {
  readonly id: string;
  readonly titre: string;
  readonly questions: ReadonlyArray<Question>;
};

/**
 * L'âge est **seul sur son écran**, et cet écran est bloquant.
 *
 * Le Tally actuel pose la question sans conséquence. Ici, « moins de 18 ans »
 * arrête le parcours : pas de compte, pas de lead, aucune écriture. Le mettre
 * tôt et isolé n'est pas cosmétique — c'est ce qui garantit qu'on n'a rien
 * enregistré au moment où on refuse.
 */
export const ECRANS: ReadonlyArray<Ecran> = [
  {
    id: 'identite',
    titre: 'Faisons connaissance',
    questions: [
      { type: 'texte', champ: 'prenom', libelle: 'Quel est ton prénom ?' },
      { type: 'email', champ: 'email', libelle: 'Quelle est ton adresse email ?' },
      { type: 'tel', champ: 'telephone', libelle: 'Quel est ton numéro de téléphone ?' },
      {
        type: 'choix',
        champ: 'zone_geo',
        libelle: 'Dans quelle zone géographique es-tu basé(e) ?',
        options: ZONES_GEO,
      },
    ],
  },
  {
    id: 'age',
    titre: 'Ton âge',
    questions: [
      {
        type: 'choix',
        champ: 'tranche_age',
        libelle: 'Quel âge as-tu ?',
        options: TRANCHES_AGE,
      },
    ],
  },
  {
    id: 'situation',
    titre: 'Ta situation',
    questions: [
      {
        type: 'choix',
        champ: 'situation_pro',
        libelle: 'Quelle est ta situation professionnelle ?',
        options: SITUATIONS_PRO,
      },
      {
        type: 'choix',
        champ: 'niveau_trading',
        libelle: 'Où en es-tu dans ton parcours trading ?',
        options: NIVEAUX_TRADING,
      },
    ],
  },
  {
    id: 'qualification',
    titre: 'Ton projet',
    questions: [
      {
        type: 'choix',
        champ: 'prop_firm',
        libelle: 'As-tu une prop firm actuellement ?',
        options: PROP_FIRM,
      },
      {
        type: 'choix',
        champ: 'blocage',
        libelle: "Aujourd'hui, quel est ton plus gros blocage ?",
        options: BLOCAGES,
      },
      {
        type: 'choix',
        champ: 'tranche_budget',
        libelle: 'Quel budget es-tu prêt à investir dans ton parcours ?',
        options: TRANCHES_BUDGET,
      },
      {
        type: 'choix',
        champ: 'delai_objectif',
        libelle: 'Dans quel délai souhaiterais-tu atteindre ton objectif ?',
        options: DELAIS_OBJECTIF,
      },
    ],
  },
];

/** Tous les champs attendus, écran d'âge compris. Sert la validation serveur. */
export const CHAMPS_ATTENDUS = ECRANS.flatMap((e) => e.questions.map((q) => q.champ));

const OPTIONS_PAR_CHAMP: Record<string, ReadonlyArray<Choix<string>>> = Object.fromEntries(
  ECRANS.flatMap((e) => e.questions)
    .filter((q): q is ChampChoix => q.type === 'choix')
    .map((q) => [q.champ, q.options]),
);

/**
 * La valeur stockée en base rendue lisible — `gestion_risque` devient
 * « Gestion du risque ».
 *
 * La fiche client de `/formateur` affiche exactement ce que le prospect a
 * répondu ; elle lit donc les mêmes libellés que le formulaire. Retaper ces
 * chaînes dans l'écran garantirait qu'un jour la fiche annonce autre chose que
 * ce que la personne a lu au moment de répondre.
 */
export function libelle(champ: string, valeur: string | null | undefined): string {
  if (!valeur) return '—';
  return OPTIONS_PAR_CHAMP[champ]?.find((o) => o.valeur === valeur)?.libelle ?? valeur;
}
