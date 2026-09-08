import { dateHeure } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

const ETATS: Record<string, string> = {
  planifie: 'Planifié',
  confirme: 'Confirmé',
  reporte: 'Reporté',
  annule: 'Annulé',
  honore: 'Honoré',
  absent: 'Non honoré',
};

/**
 * `/espace/rendez-vous` — les audits, passés et à venir.
 *
 * Lecture seule, et c'est volontaire : un client n'annule pas son rendez-vous
 * depuis le site, il le fait depuis le lien Cal.com de sa confirmation, qui
 * nous en informe par webhook. Lui offrir un bouton ici créerait deux sources
 * de vérité pour le même créneau, et celle qui perdrait serait la nôtre.
 *
 * Aucun lien de visioconférence n'est affiché : le site n'en émet aucun.
 */
export default async function Page() {
  const supabase = await createClient();
  const maintenant = new Date().toISOString();

  const [aVenir, passes] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, debut, statut')
      .gte('debut', maintenant)
      .order('debut'),
    supabase
      .from('appointments')
      .select('id, debut, statut, issue')
      .lt('debut', maintenant)
      .order('debut', { ascending: false }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Mes rendez-vous</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">À venir</h2>
        {aVenir.data?.length ? (
          <ul className="divide-y rounded border text-sm">
            {aVenir.data.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 p-3">
                <span>{dateHeure(r.debut)}</span>
                <span className="text-neutral-500">{ETATS[r.statut] ?? r.statut}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">
            Aucun rendez-vous à venir. Après ton achat, les séances s’organisent directement avec
            ton formateur.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Passés</h2>
        {passes.data?.length ? (
          <ul className="divide-y rounded border text-sm">
            {passes.data.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 p-3">
                <span>{dateHeure(r.debut)}</span>
                {/* Le compte rendu du formateur n'apparaît pas ici : c'est une
                    note de travail interne, pas un retour rédigé pour le client. */}
                <span className="text-neutral-500">{ETATS[r.issue ?? r.statut] ?? r.statut}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Aucun rendez-vous passé.</p>
        )}
      </section>
    </div>
  );
}
