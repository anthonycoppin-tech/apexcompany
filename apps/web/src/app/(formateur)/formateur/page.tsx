import Link from 'next/link';

import { bornesDuJour, dateHeure, heure } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

/**
 * `/formateur` — ce que Franck ouvre le matin.
 *
 * Toutes les requêtes passent par le client à session, donc par la RLS : ce qui
 * s'affiche ici est exactement ce que les politiques laissent lire, et pas un
 * sous-ensemble choisi par un `where`. Un filtre applicatif oublié ne peut donc
 * pas élargir le périmètre — au pire il le rétrécit.
 *
 * Aucun montant sur cet écran, ni ailleurs dans cette zone.
 */
export default async function Page() {
  const supabase = await createClient();
  const { debut, fin } = bornesDuJour();

  const [aujourdhui, aVenir, propositions, prospects] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, debut, fin, statut, issue, leads(id, prenom, nom)')
      .gte('debut', debut)
      .lt('debut', fin)
      .order('debut'),
    supabase
      .from('appointments')
      .select('id, debut, statut, leads(id, prenom, nom)')
      .gte('debut', fin)
      .order('debut')
      .limit(5),
    supabase
      .from('propositions')
      .select('id, statut, expire_le, formations(titre)')
      .eq('statut', 'envoyee')
      .order('expire_le'),
    supabase
      .from('leads')
      .select('id, prenom, nom, tranche_budget, created_at')
      .eq('statut', 'nouveau')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const nom = (l: { prenom: string | null; nom: string | null } | null) =>
    [l?.prenom, l?.nom].filter(Boolean).join(' ') || 'Prospect sans nom';

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Aujourd’hui</h2>
        {aujourdhui.data?.length ? (
          <ul className="divide-y rounded border">
            {aujourdhui.data.map((rdv) => (
              <li key={rdv.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <span className="tabular-nums text-neutral-500">{heure(rdv.debut)}</span>
                <span className="flex-1">{nom(rdv.leads)}</span>
                <span className="text-neutral-500">{rdv.issue ?? rdv.statut}</span>
                {rdv.leads && (
                  <Link href={`/formateur/clients/${rdv.leads.id}`} className="underline">
                    Préparer
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Aucun rendez-vous aujourd’hui.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Prochains audits</h2>
        {aVenir.data?.length ? (
          <ul className="divide-y rounded border">
            {aVenir.data.map((rdv) => (
              <li key={rdv.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <span className="text-neutral-500">{dateHeure(rdv.debut)}</span>
                <span className="flex-1">{nom(rdv.leads)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Aucun audit à venir.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Propositions en attente</h2>
        {propositions.data?.length ? (
          <ul className="divide-y rounded border">
            {propositions.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <span className="flex-1">{p.formations?.titre ?? 'Formation'}</span>
                {/* Une proposition expire : c'est un levier de vente, et la date
                    est le premier chiffre à voir de cet écran. */}
                <span className="text-neutral-500">
                  {p.expire_le ? `expire le ${dateHeure(p.expire_le)}` : 'sans échéance'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Aucune proposition en attente de réponse.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Prospects à rappeler</h2>
        <p className="text-sm text-neutral-500">
          Ils ont rempli le formulaire sans réserver de créneau.
        </p>
        {prospects.data?.length ? (
          <ul className="divide-y rounded border">
            {prospects.data.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <Link href={`/formateur/clients/${l.id}`} className="flex-1 underline">
                  {nom(l)}
                </Link>
                <span className="text-neutral-500">{dateHeure(l.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Aucun prospect en attente.</p>
        )}
      </section>
    </div>
  );
}
