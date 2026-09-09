import { formaterMontant } from '@apex/db';

import { Carte } from '@/components/ui';
import { dateCourte } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

import { BoutonResilier } from './bouton-resilier';

const ETATS_ABO: Record<string, string> = {
  active: 'Actif',
  impayee: 'Prélèvement en échec',
  resiliee: 'Résilié — accès ouvert jusqu’au terme',
  terminee: 'Terminé',
};

/**
 * `/espace/factures` — ce qu'il a payé, et son abonnement.
 *
 * L'abonnement se résilie **ici**. Un abonnement qu'on ne peut annuler que par
 * email est une source de litige, et selon les cas une non-conformité : le
 * bouton n'est pas un confort d'interface.
 */
export default async function Page() {
  const supabase = await createClient();

  const [factures, abonnements] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, numero, emise_at, pdf_url, orders(montant_cents, devise, formations(titre))')
      .order('emise_at', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('id, statut, periode_fin, resiliation_demandee_le, formations(titre)')
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-extrabold">Factures et abonnement</h1>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Mon abonnement</h2>
        {abonnements.data?.length ? (
          <ul className="space-y-4">
            {abonnements.data.map((a) => (
              <li key={a.id}>
                <Carte className={`space-y-3 ${a.statut === 'impayee' ? 'border-alerte' : ''}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="font-semibold">{a.formations?.titre ?? 'Abonnement'}</span>
                    {/* Un prélèvement en échec est la seule ligne de cette page qui
                      demande une action : elle se distingue au lieu de se fondre. */}
                    <span
                      className={
                        a.statut === 'impayee'
                          ? 'text-sm font-semibold text-alerte'
                          : 'text-sm text-encre-doux'
                      }
                    >
                      {ETATS_ABO[a.statut] ?? a.statut}
                    </span>
                  </div>

                  {a.periode_fin && (
                    <p className="text-sm text-encre-doux">
                      {a.statut === 'active'
                        ? `Prochain prélèvement le ${dateCourte(a.periode_fin)}.`
                        : `Accès ouvert jusqu’au ${dateCourte(a.periode_fin)}.`}
                    </p>
                  )}

                  {a.statut === 'impayee' && (
                    <p className="text-sm leading-relaxed text-encre-doux">
                      Le dernier prélèvement n’est pas passé. Ton accès reste ouvert — vérifie ton
                      moyen de paiement.
                    </p>
                  )}

                  {a.statut === 'active' && a.periode_fin && (
                    <BoutonResilier
                      subscriptionId={a.id}
                      finDePeriode={dateCourte(a.periode_fin)}
                    />
                  )}
                </Carte>
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucun abonnement en cours.</p>
          </Carte>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Mes factures</h2>
        {factures.data?.length ? (
          <div className="overflow-x-auto rounded-carte border border-filet bg-fond">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-filet text-left text-encre-doux">
                  <th className="px-4 py-3 font-medium">Numéro</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Objet</th>
                  <th className="px-4 py-3 font-medium">Montant</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet">
                {factures.data.map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-3 tabular-nums">{f.numero}</td>
                    <td className="px-4 py-3">{dateCourte(f.emise_at)}</td>
                    <td className="px-4 py-3">{f.orders?.formations?.titre ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {f.orders ? formaterMontant(f.orders.montant_cents, f.orders.devise) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {/* Le PDF n'est généré qu'à l'émission ; tant qu'il manque,
                          la ligne reste lisible plutôt que d'offrir un lien mort. */}
                      {f.pdf_url ? (
                        <a href={f.pdf_url} className="font-semibold text-accent hover:underline">
                          Télécharger
                        </a>
                      ) : (
                        <span className="text-encre-faible">en préparation</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucune facture pour l’instant.</p>
          </Carte>
        )}
      </section>
    </div>
  );
}
