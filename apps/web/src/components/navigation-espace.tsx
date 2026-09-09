'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type LienEspace = { href: string; libelle: string };

/**
 * La navigation des espaces connectés — client et formateur.
 *
 * L'état actif se calcule par **le lien le plus long qui correspond**, jamais
 * par un simple préfixe : `/espace` préfixe `/espace/factures`, donc « Mes
 * accès » resterait allumé sur toutes les pages. Trier par longueur règle le
 * cas de la racine comme celui des sous-pages, sans marquer les liens à la
 * main.
 */
export function NavigationEspace({ liens }: { liens: LienEspace[] }) {
  const chemin = usePathname();

  const actif = liens
    .filter((l) => chemin === l.href || chemin.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      {liens.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.href === actif ? 'page' : undefined}
          className={
            l.href === actif
              ? 'rounded-douce bg-accent-doux px-3 py-1.5 font-semibold text-accent'
              : 'rounded-douce px-3 py-1.5 text-encre-doux transition-colors hover:bg-surface hover:text-encre'
          }
        >
          {l.libelle}
        </Link>
      ))}
    </nav>
  );
}
