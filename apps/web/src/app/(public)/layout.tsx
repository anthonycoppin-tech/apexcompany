import Link from 'next/link';
import type { ReactNode } from 'react';

import { EtatSession } from '@/components/etat-session';
import { AvertissementRisque, Bouton, Conteneur } from '@/components/ui';

const NAVIGATION = [
  { href: '/formations', libelle: 'Programmes' },
  { href: '/formateurs', libelle: 'L’équipe' },
  { href: '/faq', libelle: 'Questions fréquentes' },
  { href: '/contact', libelle: 'Contact' },
];

const LEGAL = [
  { href: '/mentions-legales', libelle: 'Mentions légales' },
  { href: '/cgv', libelle: 'CGV' },
  { href: '/confidentialite', libelle: 'Confidentialité' },
  { href: '/cookies', libelle: 'Cookies' },
  { href: '/remboursement', libelle: 'Remboursement' },
  { href: '/accessibilite', libelle: 'Accessibilité' },
];

/**
 * Coquille du site public.
 *
 * **Un seul appel à l'action dans toute la navigation**, et il pointe vers
 * `/qualification`. C'est le principe du tunnel unique : le formulaire est la
 * porte d'entrée de tout ce qui suit — il crée le compte, attribue le rôle
 * Discord `invité` et ouvre la prise de rendez-vous. Les fiches produit servent
 * à convaincre, pas à acheter.
 *
 * Multiplier les points d'entrée — un bouton « acheter » ici, un formulaire de
 * contact là — c'est exactement ce que la révision 3 a supprimé en fusionnant
 * les funnels redondants.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-douce focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Aller au contenu
      </a>

      <header className="sticky top-0 z-40 border-b border-filet bg-fond/90 backdrop-blur">
        <Conteneur className="flex h-16 items-center justify-between gap-6">
          <Link href="/" className="font-titre text-lg font-extrabold tracking-tight">
            Apex<span className="text-accent">Company</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm md:flex">
            {NAVIGATION.map((l) => (
              <Link key={l.href} href={l.href} className="text-encre-doux hover:text-encre">
                {l.libelle}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Tout le bloc dépend de la session — y compris l'appel à
                l'action, qui n'a plus de sens une fois qu'on est connecté.
                Lu dans le navigateur pour que les pages publiques restent
                statiques. Voir `etat-session.tsx`. */}
            <EtatSession />
          </div>
        </Conteneur>
      </header>

      <main id="contenu" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-filet bg-surface py-14">
        <Conteneur className="space-y-10">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3">
              <p className="font-titre text-lg font-extrabold">
                Apex<span className="text-accent">Company</span>
              </p>
              <p className="max-w-xs text-sm text-encre-doux">
                Un accompagnement structuré : psychologie de l’exécution, rigueur méthodique,
                progression par niveau.
              </p>
            </div>

            <nav className="space-y-3 text-sm">
              <p className="font-semibold">Le programme</p>
              {NAVIGATION.map((l) => (
                <Link key={l.href} href={l.href} className="block text-encre-doux hover:text-encre">
                  {l.libelle}
                </Link>
              ))}
            </nav>

            <nav className="space-y-3 text-sm">
              <p className="font-semibold">Informations</p>
              {LEGAL.map((l) => (
                <Link key={l.href} href={l.href} className="block text-encre-doux hover:text-encre">
                  {l.libelle}
                </Link>
              ))}
            </nav>

            <div className="space-y-3 text-sm">
              <p className="font-semibold">Commencer</p>
              <p className="text-encre-doux">
                Deux minutes de questions, puis un échange d’orientation de 30 minutes, offert et
                sans engagement.
              </p>
              <Bouton href="/qualification" variante="secondaire" className="px-4 py-2">
                Faire le point
              </Bouton>
            </div>
          </div>

          <div className="space-y-4 border-t border-filet pt-8">
            <AvertissementRisque />
            <p className="text-xs text-encre-faible">
              © {new Date().getFullYear()} ApexCompany. Tous droits réservés.
            </p>
          </div>
        </Conteneur>
      </footer>
    </div>
  );
}
