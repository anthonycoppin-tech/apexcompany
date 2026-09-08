import { createClient } from '@/lib/supabase/server';

/**
 * `/formateur/statistiques` — ses chiffres, et seulement les siens.
 *
 * Le périmètre n'est pas filtré ici : les politiques RLS ne laissent lire que
 * ses rendez-vous et ses propositions, donc compter tout ce qui revient donne
 * exactement ses chiffres. C'est le même mécanisme qui protège la fiche client.
 *
 * Aucun montant, là non plus. Le taux de conversion se mesure en nombre de
 * propositions acceptées, pas en euros encaissés — ce que le formateur n'a pas
 * à connaître.
 */
export default async function Page() {
  const supabase = await createClient();

  const [rdv, propositions] = await Promise.all([
    supabase.from('appointments').select('issue, debut'),
    supabase.from('propositions').select('statut'),
  ]);

  const passes = (rdv.data ?? []).filter((r) => new Date(r.debut) < new Date());
  const honores = passes.filter((r) => r.issue === 'honore').length;
  const absents = passes.filter((r) => r.issue === 'absent').length;
  const annules = passes.filter((r) => r.issue === 'annule').length;
  const aConsigner = passes.filter((r) => !r.issue).length;

  const emises = propositions.data?.length ?? 0;
  const acceptees = propositions.data?.filter((p) => p.statut === 'acceptee').length ?? 0;

  const pourcentage = (part: number, total: number) =>
    total === 0 ? '—' : `${Math.round((part / total) * 100)} %`;

  const chiffres: Array<{ titre: string; valeur: string; detail: string }> = [
    {
      titre: 'Audits honorés',
      valeur: String(honores),
      detail: `${pourcentage(honores, honores + absents + annules)} des rendez-vous consignés`,
    },
    {
      titre: 'Rendez-vous manqués',
      valeur: String(absents),
      detail: 'Personne ne s’est présenté',
    },
    {
      titre: 'Propositions émises',
      valeur: String(emises),
      detail: `${acceptees} acceptée${acceptees > 1 ? 's' : ''}`,
    },
    {
      titre: 'Conversion',
      valeur: pourcentage(acceptees, emises),
      detail: 'Propositions acceptées sur propositions émises',
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Mes statistiques</h1>

      {aConsigner > 0 && (
        <p className="rounded border border-dashed p-3 text-sm text-neutral-600">
          {aConsigner} rendez-vous passé{aConsigner > 1 ? 's' : ''} sans issue consignée. Tant
          qu’ils ne le sont pas, ces chiffres sous-estiment autant les audits honorés que les
          absences.
        </p>
      )}

      <dl className="grid gap-4 sm:grid-cols-2">
        {chiffres.map((c) => (
          <div key={c.titre} className="space-y-1 rounded border p-4">
            <dt className="text-xs uppercase tracking-wide text-neutral-500">{c.titre}</dt>
            <dd className="text-3xl font-semibold tabular-nums">{c.valeur}</dd>
            <p className="text-sm text-neutral-500">{c.detail}</p>
          </div>
        ))}
      </dl>
    </div>
  );
}
