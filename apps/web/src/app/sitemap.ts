import type { MetadataRoute } from 'next';

import { urlSite } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

/**
 * `/sitemap.xml`.
 *
 * Il ne liste que des pages publiques et réellement remplies. Les absences
 * sont volontaires :
 *
 * - **`/accessibilite`**, seule page légale encore à l'état de gabarit faute
 *   d'audit — l'annoncer reviendrait à faire noter du vide à un moteur. Les
 *   cinq autres sont écrites depuis le 21 septembre 2026 et y figurent ;
 * - **`/evenements`**, pour la même raison et une de plus : la billetterie est
 *   reportée après la première livraison (`docs/02-SITEMAP.md`), la page n'est
 *   liée depuis nulle part, et elle n'a pas de contenu ;
 * - **`/connexion`, `/reserver` et les écrans de souscription**, qui n'ont de
 *   sens qu'au sein d'un parcours ;
 * - **tout ce qui vit derrière une garde de rôle**, déjà refusé par `robots.ts`.
 *
 * Le catalogue vient de la base, pas d'une liste écrite ici, et `actif` est
 * filtré explicitement. Ce n'était pas le cas au départ : le commentaire
 * affirmait que `formations_publiques_en_lecture` suffisait, ce qui est faux —
 * les politiques d'une même commande se combinent en OU, et le staff lit aussi
 * les brouillons. Aucun brouillon n'a jamais pu fuiter vers un moteur, qui
 * interroge en anonyme, mais cette route sert le même XML à qui la demande :
 * autant qu'elle réponde la même chose à tout le monde.
 */
type Frequence = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;

const PAGES: Array<{ chemin: string; priorite: number; frequence: Frequence }> = [
  { chemin: '', priorite: 1, frequence: 'weekly' },
  { chemin: '/formations', priorite: 0.9, frequence: 'weekly' },
  { chemin: '/qualification', priorite: 0.8, frequence: 'monthly' },
  { chemin: '/formateurs', priorite: 0.6, frequence: 'monthly' },
  { chemin: '/faq', priorite: 0.6, frequence: 'monthly' },
  { chemin: '/contact', priorite: 0.5, frequence: 'yearly' },
  { chemin: '/mentions-legales', priorite: 0.2, frequence: 'yearly' },
  { chemin: '/cgv', priorite: 0.3, frequence: 'yearly' },
  { chemin: '/avertissement', priorite: 0.3, frequence: 'yearly' },
  { chemin: '/remboursement', priorite: 0.3, frequence: 'yearly' },
  { chemin: '/confidentialite', priorite: 0.2, frequence: 'yearly' },
  { chemin: '/cookies', priorite: 0.1, frequence: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const { data: formations } = await supabase
    .from('formations')
    .select('slug, updated_at')
    .eq('actif', true)
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
