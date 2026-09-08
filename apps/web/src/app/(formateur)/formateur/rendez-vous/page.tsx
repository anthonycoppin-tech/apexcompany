import Link from 'next/link';

import { dateHeure } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

import { FormulaireIssue } from './formulaire-issue';

/**
 * `/formateur/rendez-vous` — les audits, et ce qu'il en est advenu.
 *
 * Les rendez-vous passés viennent en premier et portent chacun leur formulaire
 * d'issue. C'est l'inverse de l'ordre chronologique, et c'est voulu : ce qui
 * demande une action, c'est le compte rendu qu'on n'a pas encore écrit. Les
 * rendez-vous à venir, eux, n'attendent rien de personne.
 */
export default async function Page() {
  const supabase = await createClient();
  const maintenant = new Date().toISOString();

  const [passes, aVenir] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, debut, fin, statut, issue, compte_rendu, leads(id, prenom, nom, email)')
      .lt('debut', maintenant)
      .order('debut', { ascending: false })
      .limit(50),
    supabase
      .from('appointments')
      .select('id, debut, statut, leads(id, prenom, nom, email)')
      .gte('debut', maintenant)
      .order('debut'),
  ]);

  const nom = (l: { prenom: string | null; nom: string | null } | null) =>
    [l?.prenom, l?.nom].filter(Boolean).join(' ') || 'Prospect sans nom';

  const sansCompteRendu = passes.data?.filter((r) => !r.issue).length ?? 0;

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Mes rendez-vous</h1>
        {sansCompteRendu > 0 && (
          <p className="text-sm text-neutral-600">
            {sansCompteRendu} audit{sansCompteRendu > 1 ? 's' : ''} sans issue consignée.
          </p>
        )}
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Passés</h2>
        {passes.data?.length ? (
          <ul className="space-y-4">
            {passes.data.map((rdv) => (
              <li key={rdv.id} className="space-y-3 rounded border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {rdv.leads ? (
                      <Link href={`/formateur/clients/${rdv.leads.id}`} className="underline">
                        {nom(rdv.leads)}
                      </Link>
                    ) : (
                      'Réservation sans fiche prospect'
                    )}
                  </span>
                  <span className="text-sm text-neutral-500">{dateHeure(rdv.debut)}</span>
                </div>
                <FormulaireIssue id={rdv.id} issue={rdv.issue} compteRendu={rdv.compte_rendu} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Aucun audit passé.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">À venir</h2>
        {aVenir.data?.length ? (
          <ul className="divide-y rounded border">
            {aVenir.data.map((rdv) => (
              <li key={rdv.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <span className="flex-1">
                  {rdv.leads ? (
                    <Link href={`/formateur/clients/${rdv.leads.id}`} className="underline">
                      {nom(rdv.leads)}
                    </Link>
                  ) : (
                    'Réservation sans fiche prospect'
                  )}
                </span>
                <span className="text-neutral-500">{dateHeure(rdv.debut)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Aucun audit à venir.</p>
        )}
      </section>
    </div>
  );
}
