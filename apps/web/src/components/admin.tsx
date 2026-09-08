import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Les primitives du back-office.
 *
 * Le back-office ne se lit pas, il s'opère : on y cherche une ligne, on repère
 * ce qui cloche, on agit. D'où des tableaux denses plutôt que des cartes
 * aérées, et un état encodé dans la FORME autant que dans le mot — une
 * pastille colorée se repère en balayant une colonne, pas un texte.
 *
 * La couleur sémantique (bon / attention / problème) est distincte de l'accent
 * du site : sur un écran où tout est important, un accent partout ne signale
 * plus rien.
 */

export function EnTete({
  titre,
  description,
  action,
}: {
  titre: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-filet pb-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{titre}</h1>
        {description && <p className="text-sm text-encre-doux">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export type Ton = 'neutre' | 'bon' | 'attente' | 'probleme';

const tons: Record<Ton, string> = {
  neutre: 'bg-surface-forte text-encre-doux',
  bon: 'bg-succes/10 text-succes',
  attente: 'bg-alerte/10 text-alerte',
  probleme: 'bg-alerte text-white',
};

export function Pastille({ ton = 'neutre', children }: { ton?: Ton; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${tons[ton]}`}
    >
      {children}
    </span>
  );
}

/**
 * Un chiffre du tableau de bord.
 *
 * `href` est optionnel mais recommandé : un chiffre qui interpelle sans mener
 * à la liste correspondante oblige à chercher soi-même, ce qui est exactement
 * ce qu'un tableau de bord doit éviter.
 */
export function Tuile({
  libelle,
  valeur,
  detail,
  href,
  ton = 'neutre',
}: {
  libelle: string;
  valeur: string;
  detail?: string;
  href?: string;
  ton?: Ton;
}) {
  const contenu = (
    <>
      <p className="text-xs font-medium tracking-wide text-encre-doux uppercase">{libelle}</p>
      <p
        className={`font-titre text-3xl font-extrabold tabular-nums ${
          ton === 'probleme' ? 'text-alerte' : ton === 'bon' ? 'text-succes' : 'text-encre'
        }`}
      >
        {valeur}
      </p>
      {detail && <p className="text-sm text-encre-doux">{detail}</p>}
    </>
  );

  const classes = 'block space-y-1 rounded-carte border border-filet bg-fond p-5';

  return href ? (
    <Link href={href} className={`${classes} transition-colors hover:bg-surface`}>
      {contenu}
    </Link>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}

/**
 * Tableau scrollable horizontalement dans son propre conteneur : une colonne
 * de trop ne doit jamais faire glisser la page entière.
 */
export function Tableau({
  colonnes,
  children,
  largeurMin = '52rem',
}: {
  colonnes: string[];
  children: ReactNode;
  largeurMin?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth: largeurMin }}>
        <thead>
          <tr className="border-b border-filet text-left">
            {colonnes.map((c) => (
              <th key={c} className="py-2.5 pr-4 font-medium text-encre-doux">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Vide({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-carte border border-dashed border-filet-fort p-6 text-sm text-encre-doux">
      {children}
    </p>
  );
}
