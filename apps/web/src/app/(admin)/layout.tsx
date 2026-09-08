import Link from 'next/link';
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
 * **Le refus fin par section se pose page par page, et pas ici** : `/audit` et
 * `/parametres` sont réservés à `owner`, et ces pages le vérifient
 * elles-mêmes. Un menu qui masque un lien n'est pas une protection — c'est la
 * page qui doit refuser, et derrière elle la RLS.
 *
 * Ce garde décide qui VOIT l'écran. Ce que chaque requête peut réellement lire
 * reste imposé par les politiques. C'est elle la vraie frontière.
 */

const SECTIONS: Array<{ titre: string; liens: Array<{ href: string; libelle: string }> }> = [
  {
    titre: 'Pilotage',
    liens: [{ href: '/admin', libelle: 'Tableau de bord' }],
  },
  {
    titre: 'Commercial',
    liens: [
      { href: '/admin/crm/leads', libelle: 'Prospects' },
      { href: '/admin/propositions', libelle: 'Propositions' },
      { href: '/admin/formations', libelle: 'Catalogue' },
    ],
  },
  {
    titre: 'Argent',
    liens: [
      { href: '/admin/paiements/transactions', libelle: 'Transactions' },
      { href: '/admin/abonnements', libelle: 'Abonnements' },
      { href: '/admin/documents', libelle: 'Factures' },
      { href: '/admin/paiements/remboursements', libelle: 'Remboursements' },
      { href: '/admin/paiements/litiges', libelle: 'Litiges' },
    ],
  },
  {
    titre: 'Technique',
    liens: [
      { href: '/admin/logs', libelle: 'Automatisations' },
      { href: '/admin/utilisateurs', libelle: 'Comptes et rôles' },
      { href: '/admin/audit', libelle: 'Audit' },
      { href: '/admin/parametres', libelle: 'Paramètres' },
    ],
  },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const roles = await requireRole(['admin', 'owner']);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-filet bg-fond">
        <div className="flex h-14 items-center justify-between gap-6 px-5">
          <Link href="/admin" className="font-titre text-sm font-extrabold tracking-tight">
            Apex<span className="text-accent">Company</span>
            <span className="ml-2 text-xs font-medium text-encre-doux">back-office</span>
          </Link>
          <span className="text-xs text-encre-doux">{roles.join(' · ')}</span>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <nav className="border-b border-filet bg-fond lg:w-56 lg:flex-none lg:border-r lg:border-b-0">
          <div className="flex gap-6 overflow-x-auto p-5 lg:flex-col lg:gap-6 lg:overflow-visible">
            {SECTIONS.map((s) => (
              <div key={s.titre} className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-encre-faible uppercase">
                  {s.titre}
                </p>
                <div className="flex gap-4 lg:flex-col lg:gap-1.5">
                  {s.liens.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="text-sm whitespace-nowrap text-encre-doux hover:text-encre"
                    >
                      {l.libelle}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <main className="flex-1 space-y-8 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
