import type { NextConfig } from 'next';

/**
 * Les en-têtes de sécurité, posés sur toutes les réponses.
 *
 * Le minimum qui ne casse rien, choisi en fonction de ce que le site fait
 * réellement :
 *
 * - **Pas d'affichage dans un cadre d'un autre site** (`frame-ancestors`,
 *   doublé de `X-Frame-Options` pour les navigateurs anciens). Sans lui, un
 *   faux site peut encadrer le back-office et faire cliquer un membre de
 *   l'équipe sur « Exécuter le remboursement » sans qu'il le voie. `'self'` et
 *   non `'none'` : l'aperçu des emails de `/admin/emails` est un cadre du site.
 * - **HTTPS obligatoire** une fois venu par HTTPS (`Strict-Transport-Security`).
 *   Sans effet sur localhost, que les navigateurs servent en HTTP.
 * - `nosniff`, une politique de référent qui ne transmet pas les chemins
 *   complets aux autres sites — une adresse de proposition n'a rien à faire
 *   chez un tiers —, et ni caméra, ni micro, ni position.
 *
 * **Pas de politique de contenu complète** (`script-src`…) : Next.js injecte
 * des scripts en ligne, et une politique stricte demande des nonces par
 * requête, donc des pages toutes dynamiques. À reprendre si un jour le besoin
 * le justifie ; `frame-ancestors`, lui, se pose seul sans rien restreindre.
 */
const ENTETES = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:chemin*', headers: ENTETES }];
  },
  // L'ancien site publiait son avertissement sous `/disclaimer`, et ses CGV y
  // renvoyaient : un lien déjà diffusé ne doit pas tomber sur une 404.
  async redirects() {
    return [
      { source: '/disclaimer', destination: '/avertissement', permanent: true },
      // L'ancienne page du rôle branding, retiré le 25 septembre 2026 : un favori
      // du staff mène à la même page, dans le back-office.
      { source: '/statistiques', destination: '/admin/reseaux', permanent: false },
    ];
  },
};

export default nextConfig;
