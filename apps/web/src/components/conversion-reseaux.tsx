import Link from 'next/link';

import { EnTete, Tableau, Tuile, Vide } from '@/components/admin';
import { SOURCES } from '@/lib/crm/pipeline';
import { createClient } from '@/lib/supabase/server';

const PERIODES = [
  { valeur: '30', libelle: '30 jours', jours: 30 },
  { valeur: '90', libelle: '90 jours', jours: 90 },
  { valeur: '365', libelle: '12 mois', jours: 365 },
  { valeur: 'tout', libelle: 'Depuis le début', jours: null },
] as const;

function dateDepuis(jours: number | null): string {
  if (jours === null) return '2000-01-01';
  const d = new Date();
  d.setDate(d.getDate() - jours);
  return d.toISOString().slice(0, 10);
}

const pourcentage = (part: number, total: number) =>
  total === 0 ? '—' : `${Math.round((part / total) * 100)} %`;

/**
 * Quel réseau amène des prospects, et lequel amène des clients.
 *
 * `leads.source` est verrouillée au premier contact précisément pour que ce
 * tableau reste juste. Tout le calcul est dans `stats_conversion()`, réservée au
 * staff ; ce composant ne fait qu'afficher.
 *
 * Servi par `/admin/reseaux`. Il avait une seconde adresse, `/statistiques`,
 * pour le rôle `branding`, retiré le 25 septembre 2026.
 */
export async function ConversionReseaux({
  periode,
  chemin,
}: {
  periode: string | undefined;
  chemin: string;
}) {
  // Une valeur d'URL inconnue retombe sur 90 jours, la valeur par défaut de la
  // fonction SQL : elle n'atteint jamais la requête.
  const choisie = PERIODES.find((p) => p.valeur === periode) ?? PERIODES[1];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('stats_conversion', {
    depuis: dateDepuis(choisie.jours),
  });

  const lignes = data ?? [];
  const total = lignes.reduce(
    (acc, l) => ({ leads: acc.leads + l.leads, gagnes: acc.gagnes + l.gagnes }),
    { leads: 0, gagnes: 0 },
  );
  // La fonction trie par clients décroissants.
  const meilleure = lignes.find((l) => l.gagnes > 0);

  return (
    <div className="space-y-8">
      <EnTete
        titre="Conversion par réseau"
        description="D’où viennent les prospects, et lesquels deviennent clients."
      />

      <nav className="flex flex-wrap gap-2" aria-label="Période">
        {PERIODES.map((p) => (
          <Link
            key={p.valeur}
            href={`${chemin}?periode=${p.valeur}`}
            aria-current={p.valeur === choisie.valeur ? 'page' : undefined}
            className={`rounded-douce border px-3 py-1.5 text-sm ${
              p.valeur === choisie.valeur
                ? 'border-encre bg-encre text-fond'
                : 'border-filet text-encre-doux hover:bg-fond'
            }`}
          >
            {p.libelle}
          </Link>
        ))}
      </nav>

      {error ? (
        <Vide>Les statistiques n’ont pas pu être lues : {error.message}</Vide>
      ) : lignes.length === 0 ? (
        <Vide>Aucun prospect sur cette période.</Vide>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Tuile libelle="Prospects" valeur={String(total.leads)} />
            <Tuile
              libelle="Clients"
              valeur={String(total.gagnes)}
              detail={`${pourcentage(total.gagnes, total.leads)} des prospects`}
            />
            <Tuile
              libelle="Réseau qui convertit le plus"
              valeur={meilleure ? (SOURCES[meilleure.source] ?? meilleure.source) : '—'}
              detail={
                meilleure
                  ? `${meilleure.gagnes} client${meilleure.gagnes > 1 ? 's' : ''}`
                  : 'Aucun client sur la période'
              }
            />
          </div>

          <Tableau
            colonnes={['Réseau', 'Prospects', 'Audit ou au-delà', 'Clients', 'Conversion']}
            largeurMin="36rem"
          >
            {lignes.map((l) => (
              <tr key={l.source} className="border-b border-filet last:border-0">
                <td className="py-2.5 pr-4 font-medium">{SOURCES[l.source] ?? l.source}</td>
                <td className="py-2.5 pr-4 tabular-nums">{l.leads}</td>
                <td className="py-2.5 pr-4 tabular-nums">{l.rdv}</td>
                <td className="py-2.5 pr-4 tabular-nums">{l.gagnes}</td>
                <td className="py-2.5 pr-4 tabular-nums">{pourcentage(l.gagnes, l.leads)}</td>
              </tr>
            ))}
          </Tableau>

          {/* Ce que les colonnes ne disent pas d'elles-mêmes : sans ces deux
              précisions, un chiffre juste se lit comme un chiffre faux. */}
          <div className="max-w-prose space-y-2 text-sm leading-relaxed text-encre-doux">
            <p>
              La période porte sur la date d’arrivée du prospect. « Audit ou au-delà » compte les
              fiches qui en sont aujourd’hui au rendez-vous, à la proposition ou à l’achat : un
              prospect perdu après son audit n’y figure plus.
            </p>
            <p>
              « Direct » regroupe les arrivées sans lien de campagne. Un lien partagé sur un réseau
              sans son paramètre <code>?src=</code> y tombe aussi.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
