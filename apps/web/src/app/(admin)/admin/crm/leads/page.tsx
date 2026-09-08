import Link from 'next/link';

import { EnTete, Pastille, Tableau, Vide } from '@/components/admin';
import { PIPELINE, SOURCES, libelleStatut, tonStatut } from '@/lib/crm/pipeline';
import { dateCourte } from '@/lib/format';
import { libelle } from '@/lib/qualification/questionnaire';
import { createClient } from '@/lib/supabase/server';

/**
 * `/admin/crm/leads` — le pipeline commercial.
 *
 * Le CRM est décrit comme le cœur du projet dans `06-PERIMETRE.md`, et cet
 * écran en est la porte d'entrée : on y cherche quelqu'un, on y voit qui stagne,
 * on y ouvre une fiche.
 *
 * **Le filtre passe par l'URL**, pas par un état de composant. Une vue filtrée
 * se partage alors par copier-coller — « regarde les propositions envoyées » —
 * et le retour arrière du navigateur fonctionne. C'est aussi ce qui permet aux
 * tuiles du haut d'être des liens plutôt que des chiffres morts.
 *
 * Le budget déclaré et le blocage sont dans le tableau plutôt que dans la seule
 * fiche : ce sont eux qui disent quoi proposer, et les voir en liste évite
 * d'ouvrir dix fiches pour trouver la bonne.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { statut } = await searchParams;
  const supabase = await createClient();

  // Un filtre venu de l'URL ne vaut que s'il correspond à une étape connue :
  // c'est la validation qui lui rend son type, et qui empêche une valeur
  // inventée d'atteindre la requête.
  const filtreValide = PIPELINE.find((e) => e.valeur === statut)?.valeur;

  const requete = supabase
    .from('leads')
    .select(
      'id, prenom, nom, email, statut, source, tranche_budget, blocage, niveau_trading, assigned_to, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const [{ data: leads }, { data: tous }, { data: formateurs }] = await Promise.all([
    filtreValide ? requete.eq('statut', filtreValide) : requete,
    supabase.from('leads').select('statut'),
    supabase.from('profiles').select('id, prenom, nom'),
  ]);

  const compte = (valeur: string) => (tous ?? []).filter((l) => l.statut === valeur).length;
  const nomDe = (id: string | null) => {
    if (!id) return null;
    const p = formateurs?.find((f) => f.id === id);
    return p ? [p.prenom, p.nom].filter(Boolean).join(' ') : null;
  };

  return (
    <>
      <EnTete titre="Prospects" description={`${tous?.length ?? 0} fiches au total`} />

      {/* Le pipeline en une ligne : chaque étape est un filtre, pas un chiffre
          à recopier ailleurs. */}
      <nav className="flex flex-wrap gap-2">
        <Link
          href="/admin/crm/leads"
          className={`rounded-douce border px-3 py-1.5 text-sm ${
            filtreValide
              ? 'border-filet text-encre-doux hover:bg-fond'
              : 'border-encre bg-encre text-white'
          }`}
        >
          Tous · {tous?.length ?? 0}
        </Link>
        {PIPELINE.map((etape) => (
          <Link
            key={etape.valeur}
            href={`/admin/crm/leads?statut=${etape.valeur}`}
            className={`rounded-douce border px-3 py-1.5 text-sm ${
              filtreValide === etape.valeur
                ? 'border-encre bg-encre text-white'
                : 'border-filet text-encre-doux hover:bg-fond'
            }`}
          >
            {etape.libelle} · {compte(etape.valeur)}
          </Link>
        ))}
      </nav>

      {leads?.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={[
              'Personne',
              'Statut',
              'Source',
              'Budget',
              'Blocage',
              'Affecté à',
              'Arrivé le',
            ]}
            largeurMin="62rem"
          >
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-filet last:border-0">
                <td className="py-2.5 pr-4">
                  <Link href={`/admin/crm/leads/${l.id}`} className="font-medium hover:underline">
                    {[l.prenom, l.nom].filter(Boolean).join(' ') || 'Sans nom'}
                  </Link>
                  <span className="block text-xs text-encre-faible">{l.email}</span>
                </td>
                <td className="py-2.5 pr-4">
                  <Pastille ton={tonStatut(l.statut)}>{libelleStatut(l.statut)}</Pastille>
                </td>
                <td className="py-2.5 pr-4 text-encre-doux">{SOURCES[l.source] ?? l.source}</td>
                <td className="py-2.5 pr-4">{libelle('tranche_budget', l.tranche_budget)}</td>
                <td className="py-2.5 pr-4">{libelle('blocage', l.blocage)}</td>
                <td className="py-2.5 pr-4 text-encre-doux">
                  {nomDe(l.assigned_to) ?? <span className="text-alerte">non affecté</span>}
                </td>
                <td className="py-2.5 whitespace-nowrap text-encre-doux">
                  {dateCourte(l.created_at)}
                </td>
              </tr>
            ))}
          </Tableau>
        </div>
      ) : (
        <Vide>
          {filtreValide
            ? 'Aucun prospect à cette étape.'
            : 'Aucun prospect. Ils arrivent par le formulaire de qualification.'}
        </Vide>
      )}
    </>
  );
}
