import { formaterMontant } from '@apex/db';

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
      <h1 className="text-2xl font-semibold">Factures et abonnement</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Mon abonnement</h2>
        {abonnements.data?.length ? (
          <ul className="space-y-3">
            {abonnements.data.map((a) => (
              <li key={a.id} className="space-y-2 rounded border p-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{a.formations?.titre ?? 'Abonnement'}</span>
                  <span className="text-neutral-500">{ETATS_ABO[a.statut] ?? a.statut}</span>
                </div>

                {a.periode_fin && (
                  <p className="text-neutral-600">
                    {a.statut === 'active'
                      ? `Prochain prélèvement le ${dateCourte(a.periode_fin)}.`
                      : `Accès ouvert jusqu’au ${dateCourte(a.periode_fin)}.`}
                  </p>
                )}

                {a.statut === 'impayee' && (
                  <p className="text-neutral-600">
                    Le dernier prélèvement n’est pas passé. Ton accès reste ouvert — vérifie ton
                    moyen de paiement.
                  </p>
                )}

                {a.statut === 'active' && a.periode_fin && (
                  <BoutonResilier subscriptionId={a.id} finDePeriode={dateCourte(a.periode_fin)} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">Aucun abonnement en cours.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Mes factures</h2>
        {factures.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-neutral-500">
                  <th className="py-2 pr-4 font-medium">Numéro</th>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Objet</th>
                  <th className="py-2 pr-4 font-medium">Montant</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {factures.data.map((f) => (
                  <tr key={f.id} className="border-b">
                    <td className="py-2 pr-4 tabular-nums">{f.numero}</td>
                    <td className="py-2 pr-4">{dateCourte(f.emise_at)}</td>
                    <td className="py-2 pr-4">{f.orders?.formations?.titre ?? '—'}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {f.orders ? formaterMontant(f.orders.montant_cents, f.orders.devise) : '—'}
                    </td>
                    <td className="py-2">
                      {/* Le PDF n'est généré qu'à l'émission ; tant qu'il manque,
                          la ligne reste lisible plutôt que d'offrir un lien mort. */}
                      {f.pdf_url ? (
                        <a href={f.pdf_url} className="underline">
                          Télécharger
                        </a>
                      ) : (
                        <span className="text-neutral-400">en préparation</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Aucune facture pour l’instant.</p>
        )}
      </section>
    </div>
  );
}
