import type { Database } from '@apex/db';

export type LeadSource = Database['public']['Enums']['lead_source'];

/** `?src=ig` sur le lien mis en avant sur les réseaux → valeur d'énumération. */
export const SOURCES: Readonly<Record<string, LeadSource>> = {
  ig: 'instagram',
  instagram: 'instagram',
  yt: 'youtube',
  youtube: 'youtube',
  tt: 'tiktok',
  tiktok: 'tiktok',
  sc: 'snapchat',
  snapchat: 'snapchat',
  parrainage: 'parrainage',
};

/**
 * Le code de source reconnu dans une chaîne de requête, ou `null`.
 *
 * Seuls les codes connus passent : ce qui est recopié dans un lien du site ne
 * doit pas être une chaîne arbitraire venue de l'URL.
 */
export function codeSource(recherche: string): string | null {
  const src = new URLSearchParams(recherche).get('src')?.toLowerCase() ?? '';
  return Object.hasOwn(SOURCES, src) ? src : null;
}

/**
 * Le lien vers le formulaire, qui emporte la source de la page d'arrivée.
 *
 * **Par l'adresse, pas par un cookie.** Le site ne dépose aucun traceur, et
 * `/cookies` l'affirme : un cookie qui retient le réseau d'origine pour le
 * rattacher ensuite à une personne n'est pas un cookie « strictement
 * nécessaire », il demanderait un bandeau de consentement. La contrepartie est
 * assumée : une personne qui arrive par `/?src=ig`, visite le catalogue, puis
 * s'inscrit, est comptée `direct`. Le parcours prévu — le lien des réseaux,
 * puis « Faire le point » sur la page d'arrivée — est couvert.
 */
export function lienQualification(recherche: string): string {
  const src = codeSource(recherche);
  return src ? `/qualification?src=${src}` : '/qualification';
}
