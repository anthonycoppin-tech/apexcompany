import type { ReactNode } from 'react';

import { requireRole } from '@/lib/auth/roles';

/**
 * Garde d'accès : seul le rôle `formateur` entre ici (matrice d'accès,
 * docs/02-SITEMAP.md — une seule coche sur cette ligne, et elle dit « ses
 * affectations »).
 *
 * Zone dédiée, pas un back-office dégradé : c'est le choix structurant de la
 * révision 3. Mélanger le formateur au back-office obligerait chaque page
 * d'administration à masquer la moitié de son contenu pour toujours, et le
 * premier oubli de masquage serait une fuite.
 *
 * Ce garde décide qui VOIT la zone. Il ne décide pas de QUI le formateur voit
 * dedans : « ses affectations uniquement » est une politique RLS ancrée sur
 * `inscriptions.formateur_id` et `leads.assigned_to`, pas un filtre
 * d'affichage. Un formateur qui appellerait l'API directement se heurterait à
 * la même frontière (voir CLAUDE.md, « La RLS est la sécurité, pas le filtre
 * d'affichage »).
 *
 * Et jamais un montant sur ces écrans : ni prix payé, ni facture, ni impayé.
 * Le formateur voit si l'accès est actif, pas ce qu'il a coûté.
 */
export default async function FormateurLayout({ children }: { children: ReactNode }) {
  await requireRole(['formateur']);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b p-4">
        <span className="font-semibold">Espace formateur</span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
