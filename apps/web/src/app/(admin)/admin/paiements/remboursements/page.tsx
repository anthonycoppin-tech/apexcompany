import { formaterMontant } from '@apex/db';

import { EnTete, Pastille, Tableau, Tuile, Vide, type Ton } from '@/components/admin';
import { dateHeure } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

const ETATS: Record<string, { libelle: string; ton: Ton }> = {
  demande: { libelle: 'Demandé', ton: 'attente' },
  approuve: { libelle: 'Approuvé', ton: 'attente' },
  refuse: { libelle: 'Refusé', ton: 'neutre' },
  traite: { libelle: 'Remboursé', ton: 'bon' },
};

/**
 * `/admin/paiements/remboursements` — les demandes et leur suite.
 *
 * **En lecture pour l'instant, et c'est délibéré.** Déclencher un remboursement
 * est une sortie d'argent irréversible : elle demande un appel à Stripe, une
 * garantie d'idempotence pour qu'un double clic ne rembourse pas deux fois, et
 * une colonne pour stocker l'identifiant du remboursement côté prestataire —
 * colonne qui n'existe pas encore dans `refunds`. C'est une migration et un
 * écran à part, pas un bouton ajouté au bas d'un tableau.
 *
 * En attendant, les lignes se créent en base et cet écran les suit. Un
 * remboursement n'efface jamais la facture d'origine : la numérotation est
 * continue et une facture émise ne se supprime pas.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: remboursements } = await supabase
    .from('refunds')
    .select(
      'id, montant_cents, motif, statut, traite_at, created_at, payments(montant_cents, devise, provider, provider_payment_id, orders(profiles(prenom, nom)))',
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
            colonnes={['Demandé le', 'Client', 'Montant', 'Motif', 'Statut', 'Référence paiement']}
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
                  <td className="py-2.5 font-mono text-xs text-encre-faible">
                    {r.payments?.provider_payment_id ?? '—'}
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
        Le déclenchement du remboursement chez le prestataire reste à écrire : il demande une
        garantie d’idempotence et une colonne pour l’identifiant côté Stripe. En attendant, il se
        fait depuis le tableau de bord du prestataire, et la ligne est mise à jour ici.
      </p>
    </>
  );
}
