import Link from 'next/link';

import { formaterMontant } from '@apex/db';

import { EnTete, Pastille, Tableau, Tuile, Vide, type Ton } from '@/components/admin';
import { dateCourte } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

const ETATS: Record<string, { libelle: string; ton: Ton }> = {
  brouillon: { libelle: 'Brouillon', ton: 'neutre' },
  envoyee: { libelle: 'Envoyée', ton: 'attente' },
  acceptee: { libelle: 'Acceptée', ton: 'bon' },
  refusee: { libelle: 'Refusée', ton: 'neutre' },
  expiree: { libelle: 'Expirée', ton: 'neutre' },
};

/**
 * `/admin/propositions` — ce qui a été proposé, à qui, à quel prix.
 *
 * C'est l'écran qui rend la conversion mesurable, et c'est la raison d'être de
 * cette table : un lien de paiement collé à la main dans Discord ne donnait
 * aucun de ces chiffres.
 *
 * **L'écart avec le prix catalogue est affiché.** La remise est libre depuis le
 * 8 septembre 2026 et sans plafond — ce qui la tient n'est pas une limite mais
 * une trace, et une trace qu'on n'affiche nulle part ne tient rien du tout.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: propositions } = await supabase
    .from('propositions')
    .select(
      'id, statut, montant_cents, devise, expire_le, created_at, lead_id, formations(titre, prix_cents), profiles!propositions_user_id_fkey(prenom, nom)',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const liste = propositions ?? [];
  const enAttente = liste.filter((p) => p.statut === 'envoyee');
  const acceptees = liste.filter((p) => p.statut === 'acceptee');

  const conversion =
    liste.length === 0 ? '—' : `${Math.round((acceptees.length / liste.length) * 100)} %`;

  const encaisseAccepte = acceptees.reduce((total, p) => total + p.montant_cents, 0);

  return (
    <>
      <EnTete titre="Propositions" description={`${liste.length} émises`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tuile
          libelle="En attente de réponse"
          valeur={String(enAttente.length)}
          ton={enAttente.length > 0 ? 'attente' : 'neutre'}
        />
        <Tuile libelle="Acceptées" valeur={String(acceptees.length)} ton="bon" />
        <Tuile libelle="Taux d’acceptation" valeur={conversion} />
        <Tuile
          libelle="Valeur acceptée"
          valeur={formaterMontant(encaisseAccepte)}
          detail="montant des propositions acceptées"
        />
      </div>

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={['Client', 'Produit', 'Montant', 'Écart catalogue', 'Statut', 'Expire le']}
            largeurMin="56rem"
          >
            {liste.map((p) => {
              const catalogue = p.formations?.prix_cents ?? null;
              const ecart = catalogue === null ? null : p.montant_cents - catalogue;
              const etat = ETATS[p.statut];

              return (
                <tr key={p.id} className="border-b border-filet last:border-0">
                  <td className="py-2.5 pr-4">
                    {p.lead_id ? (
                      <Link href={`/admin/crm/leads/${p.lead_id}`} className="hover:underline">
                        {[p.profiles?.prenom, p.profiles?.nom].filter(Boolean).join(' ') || '—'}
                      </Link>
                    ) : (
                      [p.profiles?.prenom, p.profiles?.nom].filter(Boolean).join(' ') || '—'
                    )}
                  </td>
                  <td className="py-2.5 pr-4">{p.formations?.titre ?? '—'}</td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    {formaterMontant(p.montant_cents, p.devise)}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    {ecart === null || ecart === 0 ? (
                      <span className="text-encre-faible">tarif</span>
                    ) : (
                      <span className={ecart < 0 ? 'text-alerte' : 'text-encre-doux'}>
                        {ecart > 0 ? '+' : '−'}
                        {formaterMontant(Math.abs(ecart), p.devise)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Pastille ton={etat?.ton ?? 'neutre'}>{etat?.libelle ?? p.statut}</Pastille>
                  </td>
                  <td className="py-2.5 whitespace-nowrap text-encre-doux">
                    {dateCourte(p.expire_le)}
                  </td>
                </tr>
              );
            })}
          </Tableau>
        </div>
      ) : (
        <Vide>Aucune proposition émise. Elles partent depuis l’espace formateur.</Vide>
      )}
    </>
  );
}
