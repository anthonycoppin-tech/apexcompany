import Link from 'next/link';
import type { ReactNode } from 'react';

import { NavigationEspace } from '@/components/navigation-espace';
import { Conteneur } from '@/components/ui';
import { requireRole } from '@/lib/auth/roles';

const LIENS = [
  { href: '/espace', libelle: 'Mes accès' },
  { href: '/espace/rendez-vous', libelle: 'Rendez-vous' },
  { href: '/espace/factures', libelle: 'Factures' },
  { href: '/espace/communaute', libelle: 'Discord' },
  { href: '/espace/compte', libelle: 'Mon compte' },
];

/**
 * Garde d'accès : seul le rôle `client` entre dans l'espace client (matrice
 * d'accès, docs/02-SITEMAP.md — une seule coche sur cette ligne). Le staff
 * consulte les données d'un client via /admin/clients/[id], pas ici.
 *
 * Ce garde décide qui VOIT l'écran. Ce que chaque requête peut réellement lire
 * reste imposé par la RLS ; ne pas relâcher l'une en pensant que l'autre
 * suffit (voir CLAUDE.md, « La RLS est la sécurité, pas le filtre d'affichage »).
 */
export default async function EspaceLayout({ children }: { children: ReactNode }) {
  await requireRole(['client']);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-filet bg-fond">
        <Conteneur className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-4">
          {/* Le logo ramène au site public : un client connecté qui veut relire
              une fiche produit ne doit pas avoir à se déconnecter pour y aller. */}
          <Link href="/" className="font-titre text-lg font-extrabold tracking-tight">
            Apex<span className="text-accent">Company</span>
          </Link>

          <NavigationEspace liens={LIENS} />
        </Conteneur>
      </header>

      <main className="flex-1">
        <Conteneur className="py-10">{children}</Conteneur>
      </main>
    </div>
  );
}
