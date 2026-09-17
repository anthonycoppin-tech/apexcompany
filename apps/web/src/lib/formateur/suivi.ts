import type { Database } from '@apex/db';

type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

/**
 * Le vocabulaire du suivi commercial côté formateur.
 *
 * Rien ici ne lit la base : ce sont les règles qui transforment des lignes en
 * « qui appeler d'abord » et « quoi faire ensuite ». Les garder hors des pages
 * permet au tableau de bord, à la liste et à la fiche de dire la même chose de
 * la même personne.
 */

export const JOUR_MS = 86_400_000;

/** Au-delà, un accompagnement individuel sans note est un client qu'on oublie. */
export const SANS_SUIVI_JOURS = 14;

export const STATUTS: Record<Enums<'lead_statut'>, string> = {
  nouveau: 'À contacter',
  contacte: 'Contacté',
  rdv: 'Audit pris',
  proposition: 'Proposition envoyée',
  gagne: 'Client',
  perdu: 'Perdu',
};

export const CANAUX = {
  appel: 'Appel',
  message: 'Message',
  note: 'Note interne',
} as const;

export type Canal = keyof typeof CANAUX;

/**
 * Les statuts qu'un formateur pose à la main. `rdv`, `proposition` et `gagne`
 * sont écrits par le système — la réservation Cal.com, l'émission d'une
 * proposition, le paiement — et les poser à la main ferait mentir le pipeline :
 * un « client » sans paiement, un « audit pris » sans rendez-vous.
 */
export const STATUTS_MANUELS = ['contacte', 'perdu'] as const;
export type StatutManuel = (typeof STATUTS_MANUELS)[number];

export const MOTIFS_PERTE = {
  injoignable: 'Injoignable',
  budget: 'Budget insuffisant',
  pas_le_moment: 'Pas le bon moment',
  concurrent: 'Parti ailleurs',
  pas_interesse: 'Plus intéressé',
  autre: 'Autre',
} as const;

export type MotifPerte = keyof typeof MOTIFS_PERTE;

type Nomme = { prenom: string | null; nom: string | null } | null | undefined;

export function nomComplet(p: Nomme, repli = 'Prospect sans nom'): string {
  return [p?.prenom, p?.nom].filter(Boolean).join(' ') || repli;
}

/** Plafond haut de chaque tranche de budget, en centimes. */
const PLAFOND_BUDGET: Record<Enums<'tranche_budget'>, number> = {
  '500_1000': 100_000,
  '1000_2000': 200_000,
  '2000_5000': 500_000,
  plus_5000: Number.POSITIVE_INFINITY,
};

/** Le prix catalogue tient-il dans le budget que la personne a déclaré ? */
export function dansLeBudget(
  prixCents: number,
  tranche: Enums<'tranche_budget'> | null,
): boolean | null {
  if (!tranche) return null;
  return prixCents <= PLAFOND_BUDGET[tranche];
}

const POIDS_BUDGET: Record<Enums<'tranche_budget'>, number> = {
  '500_1000': 1,
  '1000_2000': 2,
  '2000_5000': 3,
  plus_5000: 4,
};

const POIDS_DELAI: Record<Enums<'delai_objectif'>, number> = {
  immediat: 3,
  mois_prochain: 2,
  trois_mois: 1,
};

/**
 * L'ordre d'appel des prospects à contacter.
 *
 * Le budget et l'urgence déclarés passent devant, puis la fraîcheur : un
 * prospect rappelé dans l'heure convertit bien mieux que le même rappelé trois
 * jours plus tard, et c'est la seule variable que le formateur contrôle. Ce
 * n'est pas une note de la personne — personne ne la voit, elle ne sert qu'à
 * trier une liste.
 */
export function scoreAppel(
  l: {
    tranche_budget: Enums<'tranche_budget'> | null;
    delai_objectif: Enums<'delai_objectif'> | null;
    created_at: string;
  },
  maintenant = Date.now(),
): number {
  const budget = l.tranche_budget ? POIDS_BUDGET[l.tranche_budget] : 0;
  const delai = l.delai_objectif ? POIDS_DELAI[l.delai_objectif] : 0;
  const ageJours = (maintenant - new Date(l.created_at).getTime()) / JOUR_MS;
  const fraicheur = Math.max(0, 3 - ageJours);
  return budget * 2 + delai * 2 + fraicheur;
}

/** « il y a 3 j », « il y a 5 h » — ce qu'on lit en balayant une liste. */
export function depuis(valeur: string | null | undefined, maintenant = Date.now()): string {
  if (!valeur) return '—';
  const ecart = maintenant - new Date(valeur).getTime();
  if (ecart < 0) return 'à venir';
  const heures = Math.floor(ecart / 3_600_000);
  if (heures < 1) return 'à l’instant';
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  return `il y a ${jours} j`;
}

/**
 * Numéro utilisable dans un lien `wa.me` : chiffres seuls, indicatif compris.
 * Un numéro français saisi en 06… est ramené à +33 ; tout autre format sans
 * indicatif est laissé tel quel, et le lien ne sera simplement pas proposé.
 */
export function numeroWhatsApp(telephone: string | null | undefined): string | null {
  if (!telephone) return null;
  const brut = telephone.replace(/[^\d+]/g, '');
  if (brut.startsWith('+')) return brut.slice(1);
  if (brut.startsWith('00')) return brut.slice(2);
  if (/^0[67]\d{8}$/.test(brut)) return `33${brut.slice(1)}`;
  return null;
}

/** Le libellé lisible d'une ligne de `lead_events`. */
export function libelleEvenement(type: string, payload: unknown): string {
  const p = (payload ?? {}) as Record<string, unknown>;

  if (type === 'formulaire_soumis') return 'A rempli le formulaire';
  if (type === 'proposition_emise') return 'Proposition émise';
  if (type === 'formateur_affecte') {
    const formation = p.formation ? ` pour « ${p.formation} »` : '';
    return p.formateur_id ? `Formateur affecté${formation}` : `Affectation retirée${formation}`;
  }
  if (type === 'echange') {
    const canal = CANAUX[p.canal as Canal] ?? 'Échange';
    const apres = p.statut_apres as Enums<'lead_statut'> | undefined;
    const motif = MOTIFS_PERTE[p.motif as MotifPerte];
    if (apres === 'perdu') return `${canal} · marqué perdu${motif ? ` (${motif})` : ''}`;
    if (apres && apres !== p.statut_avant) return `${canal} · passe en « ${STATUTS[apres]} »`;
    return canal;
  }
  if (type.startsWith('cal.')) {
    const evenement = type.slice(4);
    if (evenement === 'BOOKING_CREATED') return 'A réservé son audit';
    if (evenement === 'BOOKING_RESCHEDULED') return 'A déplacé son audit';
    if (evenement === 'BOOKING_CANCELLED') return 'A annulé son audit';
    return 'Mise à jour du rendez-vous';
  }
  return type;
}

/** Médiane d'une liste de durées, `null` si vide. */
export function mediane(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 ? tri[milieu] : (tri[milieu - 1] + tri[milieu]) / 2;
}

export function duree(ms: number | null): string {
  if (ms === null) return '—';
  const heures = ms / 3_600_000;
  if (heures < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (heures < 48) return `${Math.round(heures)} h`;
  return `${Math.round(heures / 24)} j`;
}

export const pourcentage = (part: number, total: number) =>
  total === 0 ? '—' : `${Math.round((part / total) * 100)} %`;

/**
 * Les valeurs d'énumération, dites comme on les dit.
 *
 * La fiche affichait `honore`, `acceptee`, `active` tels que la base les
 * range : lisible par un développeur, pas par la personne qui prépare un appel.
 */
export const ISSUES_RDV: Record<Enums<'rdv_issue'>, string> = {
  honore: 'Honoré',
  absent: 'Absent',
  annule: 'Annulé',
};

export const STATUTS_RDV: Record<Enums<'appointment_statut'>, string> = {
  planifie: 'Planifié',
  confirme: 'Confirmé',
  honore: 'Honoré',
  absent: 'Absent',
  annule: 'Annulé',
  reporte: 'Reporté',
};

export const STATUTS_PROPOSITION: Record<Enums<'proposition_statut'>, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  expiree: 'Expirée',
};

export const STATUTS_INSCRIPTION: Record<Enums<'inscription_statut'>, string> = {
  active: 'Actif',
  suspendue: 'Suspendu',
  terminee: 'Terminé',
  remboursee: 'Remboursé',
};

/**
 * Les trois sortes de notes de suivi. Le type ne décide pas de la visibilité —
 * c'est `visible_client`, coché à la main —, mais il la suggère : un objectif
 * se partage, une observation reste le plus souvent interne.
 */
export const TYPES_NOTE: Record<Enums<'suivi_note_type'>, string> = {
  objectif: 'Objectif',
  retour: 'Retour de séance',
  observation: 'Observation',
};

export type TypeNote = Enums<'suivi_note_type'>;

/** Jours restants avant une date de fin d'accès, `null` pour un accès illimité. */
export function joursRestants(fin: string | null, maintenant = Date.now()): number | null {
  if (!fin) return null;
  // La fin d'accès est une date : l'accès court jusqu'au soir de ce jour-là.
  return Math.ceil((new Date(`${fin}T23:59:59`).getTime() - maintenant) / JOUR_MS);
}
