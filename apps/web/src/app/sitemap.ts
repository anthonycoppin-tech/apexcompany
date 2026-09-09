import type { MetadataRoute } from 'next';

import { urlSite } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

/**
 * `/sitemap.xml`.
 *
 * Il ne liste que des pages publiques et réellement remplies. Trois absences
 * sont volontaires :
 *
 * - **les six pages légales**, encore à l'état de gabarit — les annoncer
 *   reviendrait à faire noter du vide à un moteur. Elles rejoignent cette liste
 *   le jour où elles sont écrites, ce qui est de toute façon un préalable à la
 *   mise en vente (`docs/08-CE-QUI-MANQUE.md`) ;
 * - **`/connexion`, `/reserver` et les écrans de souscription**, qui n'ont de
 *   sens qu'au sein d'un parcours ;
 * - **tout ce qui vit derrière une garde de rôle**, déjà refusé par `robots.ts`.
 *
 * Le catalogue vient de la base, pas d'une liste écrite ici : la politique
 * `formations_publiques_en_lecture` ne laisse passer que les produits actifs,
 * donc un brouillon n'a aucun moyen d'atterrir dans le plan de site.
 */
type Frequence = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;

const PAGES: Array<{ chemin: string; priorite: number; frequence: Frequence }> = [
  { chemin: '', priorite: 1, frequence: 'weekly' },
  { chemin: '/formations', priorite: 0.9, frequence: 'weekly' },
  { chemin: '/qualification', priorite: 0.8, frequence: 'monthly' },
  { chemin: '/formateurs', priorite: 0.6, frequence: 'monthly' },
  { chemin: '/faq', priorite: 0.6, frequence: 'monthly' },
  { chemin: '/contact', priorite: 0.5, frequence: 'yearly' },
  { chemin: '/evenements', priorite: 0.4, frequence: 'monthly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const { data: formations } = await supabase
    .from('formations')
    .select('slug, updated_at')
    .order('ordre');

  return [
    // Pas de `lastModified` sur les pages écrites en dur : cette route est
    // rendue à chaque requête, donc la seule date disponible serait celle de la
    // requête elle-même. Un plan de site qui répond « modifiée à l'instant » à
    // chaque passage finit par être ignoré sur ce point. Mieux vaut ne rien
    // affirmer — le champ est facultatif.
    ...PAGES.map(({ chemin, priorite, frequence }) => ({
      url: `${urlSite}${chemin}`,
      changeFrequency: frequence,
      priority: priorite,
    })),
    // Les fiches produit, elles, ont une vraie date : `updated_at` est tenu par
    // un déclencheur en base, donc une correction de tarif faite au back-office
    // se voit ici sans rien à penser.
    ...(formations ?? []).map((formation) => ({
      url: `${urlSite}/formations/${formation.slug}`,
      lastModified: new Date(formation.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
