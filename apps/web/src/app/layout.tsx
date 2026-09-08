import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import type { ReactNode } from 'react';

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

export const metadata: Metadata = {
  title: {
    default: 'ApexCompany — rigueur cognitive et technique',
    template: '%s — ApexCompany',
  },
  description:
    'Un accompagnement structuré autour de trois piliers : psychologie de l’exécution, ' +
    'rigueur méthodique et progression par niveau. Échange d’orientation offert.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${titre.variable} ${texte.variable} h-full`}>
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}
