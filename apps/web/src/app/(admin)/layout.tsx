import type { ReactNode } from 'react';

import { requireRole } from '@/lib/auth/roles';

/**
 * Garde d'accès : admin et owner, personne d'autre.
 *
 * La révision 3 a resserré cette garde. Elle laissait entrer le coach, parce
 * que la matrice d'accès de la révision 2 lui donnait un accès *partiel* à
 * plusieurs écrans de cette zone — ses cohortes, ses sessions, ses apprenants.
 * Le formateur a désormais sa propre zone, `/formateur`, et la matrice
 * (docs/02-SITEMAP.md) ne lui laisse plus une seule coche ici. Une zone dédiée
 * plutôt qu'un back-office dégradé, précisément pour ne pas obliger chaque page
 * d'administration à masquer la moitié de son contenu pour toujours.
 *
 * Le refus fin par section (utilisateurs, logs → admin/owner ; audit,
 * paramètres → owner) reste à poser page par page quand chaque écran sera
 * construit pour de vrai.
 *
 * Ce garde décide qui VOIT l'écran. Ce que chaque requête peut réellement lire
 * reste imposé par la RLS. C'est elle la vraie frontière.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const roles = await requireRole(['admin', 'owner']);

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
