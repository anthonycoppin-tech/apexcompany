import { formaterMontant } from '@apex/db';

import { EnTete, Pastille, Tableau, Tuile, Vide, type Ton } from '@/components/admin';
import { dateHeure } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

const ETATS: Record<string, { libelle: string; ton: Ton }> = {
  reussi: { libelle: 'Encaissé', ton: 'bon' },
  en_attente: { libelle: 'En attente', ton: 'attente' },
  echoue: { libelle: 'Échoué', ton: 'probleme' },
  rembourse: { libelle: 'Remboursé', ton: 'neutre' },
};

/**
 * `/admin/paiements/transactions` — Stripe et PayPal réunis.
 *
 * Un seul tableau pour les deux prestataires, parce que la question qu'on se
 * pose est « est-ce que cet argent est arrivé », pas « chez qui ». La colonne
 * prestataire sert au rapprochement, pas au tri.
 *
 * L'identifiant du prestataire est affiché en entier : c'est lui qu'on colle
 * dans le tableau de bord Stripe quand un paiement pose question, et le
 * tronquer pour gagner trois caractères fait perdre trois minutes à chaque
 * fois.
 */
export default async function Page() {
  const supabase = await createClient();

  const debutDuMois = new Date();
  debutDuMois.setDate(1);
  debutDuMois.setHours(0, 0, 0, 0);

  const { data: paiements } = await supabase
    .from('payments')
    .select(
      'id, montant_cents, devise, statut, provider, provider_payment_id, methode, paid_at, created_at, orders(formation_id, formations(titre), profiles(prenom, nom))',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const liste = paiements ?? [];
  const reussis = liste.filter((p) => p.statut === 'reussi');
  const duMois = reussis.filter((p) => p.paid_at && new Date(p.paid_at) >= debutDuMois);
  const echoues = liste.filter((p) => p.statut === 'echoue');

  const somme = (rows: typeof liste) => rows.reduce((t, p) => t + p.montant_cents, 0);

  return (
    <>
      <EnTete titre="Transactions" description={`${liste.length} mouvements`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tuile
          libelle="Encaissé ce mois"
          valeur={formaterMontant(somme(duMois))}
          detail={`${duMois.length} paiement${duMois.length > 1 ? 's' : ''}`}
        />
        <Tuile
          libelle="Encaissé au total"
          valeur={formaterMontant(somme(reussis))}
          detail="sur les 200 derniers mouvements"
        />
        <Tuile
          libelle="Échecs"
          valeur={String(echoues.length)}
          ton={echoues.length > 0 ? 'probleme' : 'bon'}
        />
      </div>

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={[
              'Date',
              'Client',
              'Produit',
              'Montant',
              'Statut',
              'Prestataire',
              'Référence',
            ]}
            largeurMin="66rem"
          >
            {liste.map((p) => {
              const etat = ETATS[p.statut];

              return (
                <tr key={p.id} className="border-b border-filet last:border-0">
                  <td className="py-2.5 pr-4 whitespace-nowrap text-encre-doux">
                    {dateHeure(p.paid_at ?? p.created_at)}
                  </td>
                  <td className="py-2.5 pr-4">
                    {[p.orders?.profiles?.prenom, p.orders?.profiles?.nom]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </td>
                  <td className="py-2.5 pr-4">{p.orders?.formations?.titre ?? '—'}</td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    {formaterMontant(p.montant_cents, p.devise)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Pastille ton={etat?.ton ?? 'neutre'}>{etat?.libelle ?? p.statut}</Pastille>
                  </td>
                  <td className="py-2.5 pr-4 text-encre-doux">
                    {p.provider}
                    {p.methode ? ` · ${p.methode}` : ''}
                  </td>
                  <td className="py-2.5 font-mono text-xs text-encre-faible">
                    {p.provider_payment_id ?? '—'}
                  </td>
                </tr>
              );
            })}
          </Tableau>
        </div>
      ) : (
        <Vide>Aucune transaction. Elles arrivent par les webhooks de paiement.</Vide>
      )}
    </>
  );
}
