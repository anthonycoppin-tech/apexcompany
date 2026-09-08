import { EnTete, Pastille, Tableau, Tuile, Vide, type Ton } from '@/components/admin';
import { dateHeure } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

const ETATS: Record<string, { libelle: string; ton: Ton }> = {
  succes: { libelle: 'Succès', ton: 'bon' },
  echec: { libelle: 'Échec', ton: 'probleme' },
  ignore: { libelle: 'Ignoré', ton: 'attente' },
};

function detail(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return '—';

  return Object.entries(payload as Record<string, unknown>)
    .map(([cle, valeur]) => `${cle} : ${String(valeur)}`)
    .join(' · ');
}

/**
 * `/admin/logs` — ce que les automatisations ont fait, et raté.
 *
 * C'est ici qu'on regarde quand un client dit « je n'ai pas eu mon accès ».
 * Trois déclencheurs y écrivent aujourd'hui : la liaison Discord, le traitement
 * d'un paiement, et la révocation quotidienne.
 *
 * **La révocation écrit même quand elle ne trouve rien**, et c'est délibéré :
 * un journal vide ne distingue pas « rien à faire » de « plus rien ne s'exécute
 * depuis trois semaines ». Voir une ligne quotidienne à zéro est l'information.
 *
 * `payment_events` n'apparaît pas ici et n'y apparaîtra pas : cette table n'a
 * aucune politique RLS, elle n'est écrite que par les handlers en clé de
 * service, et une ligne insérée à la main y ferait passer un vrai paiement pour
 * déjà traité.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: journaux } = await supabase
    .from('automation_logs')
    .select('id, declencheur, entite_type, entite_id, statut, details, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const liste = journaux ?? [];
  const echecs = liste.filter((l) => l.statut === 'echec');
  const derniereRevocation = liste.find((l) => l.declencheur === 'revocation.quotidienne');

  return (
    <>
      <EnTete titre="Automatisations" description={`${liste.length} derniers événements`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tuile
          libelle="Échecs"
          valeur={String(echecs.length)}
          detail="sur les 200 derniers événements"
          ton={echecs.length > 0 ? 'probleme' : 'bon'}
        />
        <Tuile
          libelle="Dernière révocation"
          valeur={derniereRevocation ? dateHeure(derniereRevocation.created_at) : 'jamais'}
          detail={
            derniereRevocation
              ? 'la tâche quotidienne tourne'
              : 'aucun passage enregistré — le planificateur est-il branché ?'
          }
          ton={derniereRevocation ? 'neutre' : 'probleme'}
        />
      </div>

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau colonnes={['Quand', 'Déclencheur', 'État', 'Détail']} largeurMin="52rem">
            {liste.map((l) => {
              const etat = ETATS[l.statut];

              return (
                <tr key={l.id} className="border-b border-filet align-top last:border-0">
                  <td className="py-2.5 pr-4 whitespace-nowrap text-encre-doux">
                    {dateHeure(l.created_at)}
                  </td>
                  <td className="py-2.5 pr-4 font-medium">{l.declencheur}</td>
                  <td className="py-2.5 pr-4">
                    <Pastille ton={etat?.ton ?? 'neutre'}>{etat?.libelle ?? l.statut}</Pastille>
                  </td>
                  <td className="py-2.5 text-encre-doux">{detail(l.details)}</td>
                </tr>
              );
            })}
          </Tableau>
        </div>
      ) : (
        <Vide>
          Aucun événement. Tant qu’aucune automatisation n’a tourné, ce journal reste vide.
        </Vide>
      )}
    </>
  );
}
