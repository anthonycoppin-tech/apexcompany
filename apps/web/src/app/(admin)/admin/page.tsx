import { formaterMontant } from '@apex/db';

import { EnTete, Pastille, Tableau, Tuile, Vide } from '@/components/admin';
import { bornesDuJour, dateHeure, heure } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

/**
 * `/admin` — ce qu'on ouvre le matin.
 *
 * Deux rangées, dans cet ordre : **ce qui va bien** (l'argent encaissé, les
 * accès ouverts) puis **ce qui demande une action**. Un tableau de bord qui
 * mélange les deux oblige à relire tous les chiffres pour trouver celui qui
 * cloche.
 *
 * Chaque tuile qui signale un problème mène à la liste correspondante : un
 * chiffre qui interpelle sans lien à suivre fait perdre le temps qu'il
 * prétendait faire gagner.
 *
 * Note sur les « alertes webhooks » : elles viennent d'`automation_logs`, pas
 * de `payment_events`. Cette dernière n'a **aucune politique RLS**, et c'est
 * volontaire — elle n'est écrite que par les handlers en clé de service, et
 * personne, pas même un owner, ne doit pouvoir y toucher depuis l'API. Une
 * ligne insérée à la main y ferait passer un vrai paiement pour déjà traité.
 */
export default async function Page() {
  const supabase = await createClient();

  const maintenant = new Date();

  const debutDuMois = new Date(maintenant);
  debutDuMois.setDate(1);
  debutDuMois.setHours(0, 0, 0, 0);

  // Dérivé de `maintenant` plutôt que de `Date.now()` : le compilateur React
  // refuse un appel impur pendant le rendu, et une seule lecture de l'horloge
  // garantit en prime que toutes les fenêtres de cet écran sont cohérentes
  // entre elles.
  const ilYAUneSemaine = new Date(maintenant);
  ilYAUneSemaine.setDate(ilYAUneSemaine.getDate() - 7);

  const { debut, fin } = bornesDuJour();

  const [encaisse, inscriptions, rdvDuJour, propositions, prospects, impayes, incidents] =
    await Promise.all([
      supabase
        .from('payments')
        .select('montant_cents')
        .eq('statut', 'reussi')
        .gte('paid_at', debutDuMois.toISOString()),
      supabase.from('inscriptions').select('id').eq('statut', 'active'),
      supabase
        .from('appointments')
        .select('id, debut, statut, issue, leads(prenom, nom)')
        .gte('debut', debut)
        .lt('debut', fin)
        .order('debut'),
      supabase.from('propositions').select('id').eq('statut', 'envoyee'),
      supabase.from('leads').select('id').eq('statut', 'nouveau'),
      supabase.from('subscriptions').select('id').eq('statut', 'impayee'),
      supabase
        .from('automation_logs')
        .select('id, declencheur, statut, details, created_at')
        .eq('statut', 'echec')
        .gte('created_at', ilYAUneSemaine.toISOString())
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

  const ca = (encaisse.data ?? []).reduce((total, p) => total + p.montant_cents, 0);
  const nbIncidents = incidents.data?.length ?? 0;
  const nbImpayes = impayes.data?.length ?? 0;

  return (
    <>
      <EnTete
        titre="Tableau de bord"
        description={`Situation au ${dateHeure(maintenant.toISOString())}`}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-encre-doux">L’activité</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tuile
            libelle="Encaissé ce mois"
            valeur={formaterMontant(ca)}
            detail={`${encaisse.data?.length ?? 0} paiement${(encaisse.data?.length ?? 0) > 1 ? 's' : ''}`}
            href="/admin/paiements/transactions"
          />
          <Tuile
            libelle="Accès ouverts"
            valeur={String(inscriptions.data?.length ?? 0)}
            detail="inscriptions actives"
          />
          <Tuile libelle="Rendez-vous aujourd’hui" valeur={String(rdvDuJour.data?.length ?? 0)} />
          <Tuile
            libelle="Prospects à traiter"
            valeur={String(prospects.data?.length ?? 0)}
            detail="formulaire rempli, sans rendez-vous"
            href="/admin/crm/leads"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-encre-doux">Ce qui demande une action</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tuile
            libelle="Propositions en attente"
            valeur={String(propositions.data?.length ?? 0)}
            detail="envoyées, sans réponse"
            href="/admin/propositions"
            ton={(propositions.data?.length ?? 0) > 0 ? 'attente' : 'neutre'}
          />
          <Tuile
            libelle="Prélèvements en échec"
            valeur={String(nbImpayes)}
            detail="abonnements impayés"
            href="/admin/abonnements"
            ton={nbImpayes > 0 ? 'probleme' : 'bon'}
          />
          <Tuile
            libelle="Incidents techniques"
            valeur={String(nbIncidents)}
            detail="sur les sept derniers jours"
            href="/admin/logs"
            ton={nbIncidents > 0 ? 'probleme' : 'bon'}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-encre-doux">Rendez-vous du jour</h2>
        {rdvDuJour.data?.length ? (
          <div className="rounded-carte border border-filet bg-fond p-5">
            <Tableau colonnes={['Heure', 'Prospect', 'État']} largeurMin="28rem">
              {rdvDuJour.data.map((r) => (
                <tr key={r.id} className="border-b border-filet last:border-0">
                  <td className="py-2.5 pr-4 tabular-nums">{heure(r.debut)}</td>
                  <td className="py-2.5 pr-4">
                    {[r.leads?.prenom, r.leads?.nom].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="py-2.5">
                    <Pastille ton={r.issue === 'absent' ? 'probleme' : 'neutre'}>
                      {r.issue ?? r.statut}
                    </Pastille>
                  </td>
                </tr>
              ))}
            </Tableau>
          </div>
        ) : (
          <Vide>Aucun rendez-vous aujourd’hui.</Vide>
        )}
      </section>

      {nbIncidents > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-encre-doux">Derniers incidents</h2>
          <div className="rounded-carte border border-filet bg-fond p-5">
            <Tableau colonnes={['Quand', 'Déclencheur', 'Détail']}>
              {incidents.data?.map((i) => (
                <tr key={i.id} className="border-b border-filet last:border-0 align-top">
                  <td className="py-2.5 pr-4 whitespace-nowrap text-encre-doux">
                    {dateHeure(i.created_at)}
                  </td>
                  <td className="py-2.5 pr-4 font-medium">{i.declencheur}</td>
                  <td className="py-2.5 text-encre-doux">
                    {typeof i.details === 'object' && i.details !== null
                      ? Object.entries(i.details as Record<string, unknown>)
                          .map(([cle, valeur]) => `${cle} : ${String(valeur)}`)
                          .join(' · ')
                      : '—'}
                  </td>
                </tr>
              ))}
            </Tableau>
          </div>
        </section>
      )}
    </>
  );
}
