import type { Ton } from '@/components/admin';

/**
 * Le pipeline commercial, décrit une fois.
 *
 * Les libellés et les couleurs sont partagés entre la liste des prospects, la
 * fiche et le tableau de bord. Les retaper à chaque écran, c'est se garantir
 * qu'un jour « gagné » soit vert ici et gris là — et la couleur d'un statut est
 * précisément ce qu'on lit en balayant une colonne, avant même le mot.
 *
 * L'ordre du tableau est celui du pipeline, pas l'ordre alphabétique : il porte
 * une information — on avance de haut en bas — et c'est lui qui doit servir
 * partout où les statuts s'affichent côte à côte.
 */
export const PIPELINE = [
  { valeur: 'nouveau', libelle: 'Nouveau', ton: 'attente' },
  { valeur: 'contacte', libelle: 'Contacté', ton: 'neutre' },
  { valeur: 'rdv', libelle: 'Rendez-vous pris', ton: 'neutre' },
  { valeur: 'proposition', libelle: 'Proposition envoyée', ton: 'attente' },
  { valeur: 'gagne', libelle: 'Client', ton: 'bon' },
  { valeur: 'perdu', libelle: 'Perdu', ton: 'neutre' },
] as const satisfies ReadonlyArray<{ valeur: string; libelle: string; ton: Ton }>;

export type StatutLead = (typeof PIPELINE)[number]['valeur'];

const PAR_VALEUR = new Map(PIPELINE.map((e) => [e.valeur as string, e]));

export function libelleStatut(statut: string): string {
  return PAR_VALEUR.get(statut)?.libelle ?? statut;
}

export function tonStatut(statut: string): Ton {
  return PAR_VALEUR.get(statut)?.ton ?? 'neutre';
}

/** Les sources d'acquisition, pour la colonne qui répond au pôle branding. */
export const SOURCES: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  direct: 'Direct',
  parrainage: 'Parrainage',
};
