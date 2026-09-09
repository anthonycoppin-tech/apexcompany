import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import type { ReactNode } from 'react';

import { urlSite } from '@/lib/site';

import './globals.css';

/**
 * Les deux familles du site, servies depuis notre propre domaine par next/font
 * plutôt que depuis Google : une requête de moins au chargement, et aucun
 * transfert d'adresse IP des visiteurs vers un tiers — ce qui simplifie la
 * page de confidentialité autant que le temps de rendu.
 *
 * Manrope pour les titres, Inter pour le texte. Le designer changera
 * probablement ce couple ; il ne se change qu'ici et dans `globals.css`.
 */
const titre = Manrope({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--police-titre',
  display: 'swap',
});

const texte = Inter({
  subsets: ['latin'],
  variable: '--police-texte',
  display: 'swap',
});

const TITRE = 'ApexCompany — rigueur cognitive et technique';
const DESCRIPTION =
  'Un accompagnement structuré autour de trois piliers : psychologie de l’exécution, ' +
  'rigueur méthodique et progression par niveau. Échange d’orientation offert.';

export const metadata: Metadata = {
  // Sans `metadataBase`, les adresses relatives des balises Open Graph sont
  // émises telles quelles : un partage sur un réseau social pointe alors vers
  // une page introuvable. Elle vaut localhost tant que le domaine n'est pas
  // arrêté, et `robots.ts` interdit l'indexation dans cet état.
  metadataBase: new URL(urlSite),
  title: { default: TITRE, template: '%s — ApexCompany' },
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'ApexCompany',
    locale: 'fr_FR',
    title: TITRE,
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: TITRE, description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${titre.variable} ${texte.variable} h-full`}>
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}
