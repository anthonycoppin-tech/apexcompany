import Link from 'next/link';
import type { ReactNode } from 'react';

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
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b p-4">
        <span className="font-semibold">Mon espace</span>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {LIENS.map((l) => (
            <Link key={l.href} href={l.href} className="text-neutral-600 hover:underline">
              {l.libelle}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
