import { formaterMontant } from '@apex/db';

import { EnTete, Pastille, Tableau, Tuile, Vide, type Ton } from '@/components/admin';
import { dateHeure } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

import { BoutonTraiter } from './bouton-traiter';

const ETATS: Record<string, { libelle: string; ton: Ton }> = {
  demande: { libelle: 'Demandé', ton: 'attente' },
  approuve: { libelle: 'Approuvé', ton: 'attente' },
  refuse: { libelle: 'Refusé', ton: 'neutre' },
  traite: { libelle: 'Remboursé', ton: 'bon' },
};

/**
 * `/admin/paiements/remboursements` — les demandes et leur suite.
 *
 * **Le remboursement s'exécute depuis ici**, et l'opération ne se défait pas.
 * Elle appelle Stripe puis enregistre — jamais l'inverse : enregistrer d'abord
 * laisserait, en cas d'échec, une ligne « remboursée » sans argent rendu.
 *
 * Rembourser deux fois est le seul risque qui compte, et il se pare à deux
 * endroits : une clé d'idempotence chez Stripe, construite sur l'identifiant de
 * la ligne, et `provider_refund_id` ici, dont la présence prouve que
 * l'opération a abouti.
 *
 * Un remboursement **ferme l'accès** correspondant. Rembourser sans fermer,
 * c'est offrir le produit. En revanche il n'efface jamais la facture d'origine :
 * la numérotation est continue et une facture émise ne se supprime pas.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: remboursements } = await supabase
    .from('refunds')
    .select(
      'id, montant_cents, motif, statut, traite_at, created_at, provider_refund_id, erreur, payments(montant_cents, devise, provider, provider_payment_id, orders(profiles(prenom, nom)))',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const liste = remboursements ?? [];
  const aTraiter = liste.filter((r) => r.statut === 'demande' || r.statut === 'approuve');
  const traites = liste.filter((r) => r.statut === 'traite');
  const sommeTraitee = traites.reduce((t, r) => t + r.montant_cents, 0);

  return (
    <>
      <EnTete titre="Remboursements" description={`${liste.length} demandes`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tuile
          libelle="À traiter"
          valeur={String(aTraiter.length)}
          ton={aTraiter.length > 0 ? 'attente' : 'bon'}
        />
        <Tuile libelle="Remboursés" valeur={String(traites.length)} />
        <Tuile libelle="Montant remboursé" valeur={formaterMontant(sommeTraitee)} />
      </div>

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={['Demandé le', 'Client', 'Montant', 'Motif', 'Statut', 'Action']}
            largeurMin="62rem"
          >
            {liste.map((r) => {
              const etat = ETATS[r.statut];

              return (
                <tr key={r.id} className="border-b border-filet align-top last:border-0">
                  <td className="py-2.5 pr-4 whitespace-nowrap text-encre-doux">
                    {dateHeure(r.created_at)}
                  </td>
                  <td className="py-2.5 pr-4">
                    {[r.payments?.orders?.profiles?.prenom, r.payments?.orders?.profiles?.nom]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    {formaterMontant(r.montant_cents, r.payments?.devise ?? 'EUR')}
                    {r.payments && r.montant_cents < r.payments.montant_cents && (
                      <span className="block text-xs text-encre-faible">
                        partiel sur {formaterMontant(r.payments.montant_cents, r.payments.devise)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-encre-doux">{r.motif ?? '—'}</td>
                  <td className="py-2.5 pr-4">
                    <Pastille ton={etat?.ton ?? 'neutre'}>{etat?.libelle ?? r.statut}</Pastille>
                  </td>
                  <td className="py-2.5">
                    {r.provider_refund_id ? (
                      <span className="font-mono text-xs text-encre-faible">
                        {r.provider_refund_id}
                      </span>
                    ) : r.statut === 'refuse' ? (
                      <span className="text-xs text-encre-faible">—</span>
                    ) : (
                      <BoutonTraiter
                        refundId={r.id}
                        montant={formaterMontant(r.montant_cents, r.payments?.devise ?? 'EUR')}
                      />
                    )}
                    {r.erreur && (
                      // Un remboursement qui a échoué ressemble à un
                      // remboursement qu'on a oublié de lancer. Le dire évite
                      // de le chercher.
                      <p className="mt-1 text-xs text-alerte">{r.erreur}</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </Tableau>
        </div>
      ) : (
        <Vide>Aucune demande de remboursement.</Vide>
      )}

      <p className="text-sm text-encre-doux">
        Un remboursement exécuté ferme l’accès correspondant et retire le rôle Discord — sauf si le
        client détient ce rôle par un autre produit encore actif.
      </p>
    </>
  );
}
