import Link from 'next/link';

import { Carte, LISTE } from '@/components/ui';
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
      <h1 className="text-3xl font-extrabold">Tableau de bord</h1>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Aujourd’hui</h2>
        {aujourdhui.data?.length ? (
          <ul className={LISTE}>
            {aujourdhui.data.map((rdv) => (
              <li key={rdv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
                <span className="font-medium tabular-nums">{heure(rdv.debut)}</span>
                <span className="flex-1">{nom(rdv.leads)}</span>
                <span className="text-encre-doux">{rdv.issue ?? rdv.statut}</span>
                {rdv.leads && (
                  <Link
                    href={`/formateur/clients/${rdv.leads.id}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    Préparer
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucun rendez-vous aujourd’hui.</p>
          </Carte>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Prochains audits</h2>
        {aVenir.data?.length ? (
          <ul className={LISTE}>
            {aVenir.data.map((rdv) => (
              <li key={rdv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
                <span className="text-encre-doux">{dateHeure(rdv.debut)}</span>
                <span className="flex-1">{nom(rdv.leads)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucun audit à venir.</p>
          </Carte>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Propositions en attente</h2>
        {propositions.data?.length ? (
          <ul className={LISTE}>
            {propositions.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
                <span className="flex-1">{p.formations?.titre ?? 'Formation'}</span>
                {/* Une proposition expire : c'est un levier de vente, et la date
                    est le premier chiffre à voir de cet écran. */}
                <span className="text-encre-doux">
                  {p.expire_le ? `expire le ${dateHeure(p.expire_le)}` : 'sans échéance'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucune proposition en attente de réponse.</p>
          </Carte>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Prospects à rappeler</h2>
          <p className="text-sm text-encre-doux">
            Ils ont rempli le formulaire sans réserver de créneau.
          </p>
        </div>
        {prospects.data?.length ? (
          <ul className={LISTE}>
            {prospects.data.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
                <Link
                  href={`/formateur/clients/${l.id}`}
                  className="flex-1 font-medium text-accent hover:underline"
                >
                  {nom(l)}
                </Link>
                <span className="text-encre-doux">{dateHeure(l.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucun prospect en attente.</p>
          </Carte>
        )}
      </section>
    </div>
  );
}
