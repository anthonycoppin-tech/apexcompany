import Link from 'next/link';

import { Pastille, type Ton } from '@/components/admin';
import { CHAMP, Carte } from '@/components/ui';
import { dateCourte } from '@/lib/format';
import { STATUTS, depuis, nomComplet, scoreAppel } from '@/lib/formateur/suivi';
import { libelle } from '@/lib/qualification/questionnaire';
import { createClient } from '@/lib/supabase/server';

const VUES = [
  { valeur: 'actifs', libelle: 'En cours', statuts: ['nouveau', 'contacte', 'rdv', 'proposition'] },
  { valeur: 'a_contacter', libelle: 'À contacter', statuts: ['nouveau'] },
  { valeur: 'audit', libelle: 'Audit pris', statuts: ['rdv'] },
  { valeur: 'proposition', libelle: 'Proposition', statuts: ['proposition'] },
  { valeur: 'clients', libelle: 'Clients', statuts: ['gagne'] },
  { valeur: 'perdus', libelle: 'Perdus', statuts: ['perdu'] },
  { valeur: 'tous', libelle: 'Tous', statuts: null },
] as const;

const TON_STATUT: Record<string, Ton> = {
  nouveau: 'attente',
  proposition: 'attente',
  gagne: 'bon',
};

/**
 * `/formateur/clients` — ses prospects et ses clients, dans une seule liste.
 *
 * Les séparer en deux écrans supposerait que le passage de l'un à l'autre est
 * un événement ; c'est un statut qui bouge, sur la même personne et la même
 * fiche. D'où des vues plutôt que des pages : « à contacter » trie par ordre
 * d'appel, les autres par dernier échange, le plus ancien en tête — c'est lui
 * qu'on est en train d'oublier.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string; q?: string }>;
}) {
  const { vue, q } = await searchParams;
  const choisie = VUES.find((v) => v.valeur === vue) ?? VUES[0];
  const recherche = (q ?? '').trim().toLowerCase();
  const maintenant = new Date().getTime();

  const supabase = await createClient();

  const [{ data: prospects }, { data: echanges }] = await Promise.all([
    supabase
      .from('leads')
      .select(
        'id, prenom, nom, email, telephone, statut, tranche_budget, delai_objectif, blocage, niveau_trading, created_at',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('lead_events')
      .select('lead_id, created_at')
      .eq('type', 'echange')
      .order('created_at', { ascending: false }),
  ]);

  const dernier = new Map<string, string>();
  for (const e of echanges ?? []) if (!dernier.has(e.lead_id)) dernier.set(e.lead_id, e.created_at);

  const tous = prospects ?? [];
  const compte = (statuts: readonly string[] | null) =>
    statuts ? tous.filter((p) => statuts.includes(p.statut)).length : tous.length;

  const lignes = tous
    .filter((p) => !choisie.statuts || (choisie.statuts as readonly string[]).includes(p.statut))
    .filter(
      (p) =>
        !recherche ||
        [p.prenom, p.nom, p.email, p.telephone]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(recherche)),
    )
    .sort((a, b) => {
      if (choisie.valeur === 'a_contacter') {
        return scoreAppel(b, maintenant) - scoreAppel(a, maintenant);
      }
      const da = new Date(dernier.get(a.id) ?? a.created_at).getTime();
      const db = new Date(dernier.get(b.id) ?? b.created_at).getTime();
      return choisie.valeur === 'clients' || choisie.valeur === 'tous' ? db - da : da - db;
    });

  const lienVue = (valeur: string) => {
    const params = new URLSearchParams({ vue: valeur });
    if (recherche) params.set('q', recherche);
    return `/formateur/clients?${params}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-extrabold">Mes prospects</h1>
        <form className="flex gap-2" action="/formateur/clients">
          <input type="hidden" name="vue" value={choisie.valeur} />
          <label className="sr-only" htmlFor="recherche">
            Rechercher
          </label>
          <input
            id="recherche"
            name="q"
            type="search"
            defaultValue={q ?? ''}
            placeholder="Nom, email, téléphone"
            className={`${CHAMP} w-64`}
          />
        </form>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Vues">
        {VUES.map((v) => (
          <Link
            key={v.valeur}
            href={lienVue(v.valeur)}
            aria-current={v.valeur === choisie.valeur ? 'page' : undefined}
            className={`rounded-douce border px-3 py-1.5 text-sm ${
              v.valeur === choisie.valeur
                ? 'border-encre bg-encre text-white'
                : 'border-filet text-encre-doux hover:bg-fond'
            }`}
          >
            {v.libelle} · {compte(v.statuts)}
          </Link>
        ))}
      </nav>

      {lignes.length === 0 ? (
        <Carte>
          <p className="text-encre-doux">
            {tous.length === 0
              ? 'Aucune personne ne vous est affectée pour l’instant.'
              : 'Personne ne correspond à cette vue.'}
          </p>
        </Carte>
      ) : (
        <div className="overflow-x-auto rounded-carte border border-filet bg-fond">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-filet text-left text-encre-doux">
                <th className="px-4 py-3 font-medium">Personne</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Budget</th>
                <th className="px-4 py-3 font-medium">Délai</th>
                <th className="px-4 py-3 font-medium">Blocage</th>
                <th className="px-4 py-3 font-medium">Dernier échange</th>
                <th className="px-4 py-3 font-medium">Arrivé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-filet">
              {lignes.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/formateur/clients/${p.id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {nomComplet(p, 'Sans nom')}
                    </Link>
                    {p.telephone && (
                      <a
                        href={`tel:${p.telephone.replace(/\s/g, '')}`}
                        className="block text-xs text-encre-doux hover:text-encre"
                      >
                        {p.telephone}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Pastille ton={TON_STATUT[p.statut] ?? 'neutre'}>{STATUTS[p.statut]}</Pastille>
                  </td>
                  <td className="px-4 py-3">{libelle('tranche_budget', p.tranche_budget)}</td>
                  <td className="px-4 py-3">{libelle('delai_objectif', p.delai_objectif)}</td>
                  <td className="px-4 py-3">{libelle('blocage', p.blocage)}</td>
                  <td className="px-4 py-3 text-encre-doux">
                    {dernier.has(p.id) ? depuis(dernier.get(p.id), maintenant) : 'jamais'}
                  </td>
                  <td className="px-4 py-3 text-encre-doux">{dateCourte(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
