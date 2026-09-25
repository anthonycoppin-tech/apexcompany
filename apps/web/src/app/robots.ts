import type { MetadataRoute } from 'next';

import { siteIndexable, urlSite } from '@/lib/site';

/**
 * `/robots.txt`.
 *
 * Les espaces privés sont déjà fermés par les gardes de rôle et par la RLS :
 * ce fichier n'ajoute aucune sécurité et ne prétend pas en ajouter. Il évite
 * seulement qu'un moteur consomme son budget d'exploration sur des pages qui
 * lui répondront une redirection, et que des adresses internes apparaissent
 * dans un index.
 *
 * Tant que le site n'est pas servi depuis son vrai domaine, tout est interdit —
 * voir `siteIndexable` dans `lib/site.ts`.
 */
export default function robots(): MetadataRoute.Robots {
  if (!siteIndexable) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/espace',
        '/formateur',
        '/api/',
        '/connexion',
        // Écrans qui n'ont de sens qu'au sein d'un parcours : indexés seuls,
        // ils donnent un point d'entrée sans le contexte qui les précède.
        '/reserver',
        '/formations/*/souscrire',
      ],
    },
    sitemap: `${urlSite}/sitemap.xml`,
  };
}
