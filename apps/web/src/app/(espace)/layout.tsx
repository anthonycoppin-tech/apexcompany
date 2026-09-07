import type { ReactNode } from 'react';

import { requireRole } from '@/lib/auth/roles';

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
      <header className="border-b p-4">
        <span className="font-semibold">Mon espace</span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
