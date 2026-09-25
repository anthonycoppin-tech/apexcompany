import Link from 'next/link';

import { PERIODES, type Periode } from '@/lib/statistiques/periode';

/**
 * Les périodes d'un écran de statistiques, et le choix d'une journée précise.
 *
 * Le choix d'une date est un simple formulaire en GET : il marche sans
 * JavaScript, et l'URL obtenue se garde ou s'envoie telle quelle — « les
 * chiffres du challenge », c'est un lien.
 *
 * `conserver` recopie les autres paramètres de l'écran (le formateur choisi,
 * par exemple), pour qu'on ne perde pas son filtre en changeant de période.
 */
export function SelecteurPeriode({
  chemin,
  periode,
  conserver = {},
}: {
  chemin: string;
  periode: Periode;
  conserver?: Record<string, string | undefined>;
}) {
  const autres = Object.entries(conserver).filter((e): e is [string, string] => !!e[1]);
  const lien = (valeur: string) =>
    `${chemin}?${new URLSearchParams([...autres, ['periode', valeur]]).toString()}`;
  const journeeChoisie = periode.valeur === 'jour' && periode.libelle !== 'Aujourd’hui';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav className="flex flex-wrap gap-2" aria-label="Période">
        {PERIODES.map((p) => {
          const actif = p.valeur === periode.valeur && !journeeChoisie;
          return (
            <Link
              key={p.valeur}
              href={lien(p.valeur)}
              aria-current={actif ? 'page' : undefined}
              className={`rounded-douce border px-3 py-1.5 text-sm ${
                actif
                  ? 'border-encre bg-encre text-fond'
                  : 'border-filet text-encre-doux hover:bg-fond'
              }`}
            >
              {p.libelle}
            </Link>
          );
        })}
      </nav>

      <form method="get" action={chemin} className="flex items-center gap-2">
        {autres.map(([cle, valeur]) => (
          <input key={cle} type="hidden" name={cle} value={valeur} />
        ))}
        <label className="sr-only" htmlFor="jour-statistiques">
          Une journée précise
        </label>
        <input
          id="jour-statistiques"
          type="date"
          name="jour"
          required
          defaultValue={periode.jour ?? undefined}
          className={`rounded-douce border px-2 py-1 text-sm ${
            journeeChoisie ? 'border-encre' : 'border-filet'
          }`}
        />
        <button
          type="submit"
          className="rounded-douce border border-filet px-3 py-1.5 text-sm text-encre-doux hover:bg-fond"
        >
          Voir la journée
        </button>
      </form>
    </div>
  );
}
