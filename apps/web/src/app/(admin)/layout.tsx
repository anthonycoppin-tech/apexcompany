import type { ReactNode } from 'react';

import { requireRole } from '@/lib/auth/roles';

/**
 * Garde d'accès large et volontairement imprécise : coach, admin et owner
 * entrent tous dans /admin, parce que la matrice d'accès (docs/02-SITEMAP.md)
 * donne au coach un accès *partiel* — ses cohortes, ses sessions, ses
 * apprenants — à plusieurs écrans de cette zone. Le refus fin par section
 * (paiements, utilisateurs, logs, audit → admin/owner selon le cas) reste à
 * poser page par page quand chaque écran sera construit pour de vrai.
 *
 * Ce garde décide qui VOIT l'écran. Ce que chaque requête peut réellement lire
 * — un coach qui ne voit que sa cohorte, jamais un paiement, quelle que soit
 * la page — reste imposé par la RLS. C'est elle la vraie frontière.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const roles = await requireRole(['coach', 'admin', 'owner']);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <span className="font-semibold">Back-office</span>
        <span className="text-sm text-neutral-500">{roles.join(', ')}</span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
