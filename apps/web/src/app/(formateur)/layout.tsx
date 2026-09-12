import Link from 'next/link';
import type { ReactNode } from 'react';

import { BoutonDeconnexion } from '@/components/bouton-deconnexion';
import { NavigationEspace } from '@/components/navigation-espace';
import { Conteneur } from '@/components/ui';
import { requireRole } from '@/lib/auth/roles';

const LIENS = [
  { href: '/formateur', libelle: 'Tableau de bord' },
  { href: '/formateur/rendez-vous', libelle: 'Rendez-vous' },
  { href: '/formateur/clients', libelle: 'Clients' },
  { href: '/formateur/statistiques', libelle: 'Statistiques' },
];

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
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-filet bg-fond">
        <Conteneur className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-4">
          <Link href="/formateur" className="flex items-baseline gap-2">
            <span className="font-titre text-lg font-extrabold tracking-tight">
              Apex<span className="text-accent">Company</span>
            </span>
            {/* La zone est nommée : un formateur qui a aussi un compte client
                doit savoir d'un coup d'œil où il se trouve. */}
            <span className="text-sm text-encre-doux">formateur</span>
          </Link>

          <div className="flex items-center gap-4">
            <NavigationEspace liens={LIENS} />
            <BoutonDeconnexion />
          </div>
        </Conteneur>
      </header>

      <main className="flex-1">
        <Conteneur className="py-10">{children}</Conteneur>
      </main>
    </div>
  );
}
