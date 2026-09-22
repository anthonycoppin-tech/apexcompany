import { formaterMontant } from '@apex/db';

import { EnTete, Tableau, Tuile, Vide } from '@/components/admin';
import { dateCourte } from '@/lib/format';
import { regimeTva } from '@/lib/legal/societe';
import { createClient } from '@/lib/supabase/server';

/**
 * `/admin/documents` — les factures émises.
 *
 * **La numérotation est continue et ne se répare pas après coup.** Elle est
 * posée par un trigger à l'insertion, au format `AAAA-NNNNNN`, et une facture
 * émise ne peut plus être supprimée — un autre trigger l'interdit. Ce n'est pas
 * une précaution de développeur : c'est une obligation légale, et un trou dans
 * la séquence se justifie devant un contrôle.
 *
 * D'où l'absence de bouton « supprimer » sur cet écran, et le fait qu'un
 * remboursement soit une ligne de plus dans `refunds` plutôt qu'une facture
 * effacée.
 *
 * La facture elle-même se génère à la demande (`/facture/[id]`), depuis la
 * base : `pdf_url` n'est plus lue. La tuile TVA dit si les factures portent
 * déjà leur mention fiscale, qui attend le comptable.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: factures } = await supabase
    .from('invoices')
    .select(
      'id, numero, emise_at, orders(montant_cents, devise, formations(titre), profiles(prenom, nom, email))',
    )
    .order('emise_at', { ascending: false })
    .limit(200);

  const liste = factures ?? [];
  const total = liste.reduce((t, f) => t + (f.orders?.montant_cents ?? 0), 0);
  const tva = regimeTva();

  return (
    <>
      <EnTete titre="Factures" description={`${liste.length} émises`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tuile libelle="Total facturé" valeur={formaterMontant(total)} />
        <Tuile
          libelle="TVA sur les factures"
          valeur={tva ? `${tva.tauxPourcent} %` : 'en attente'}
          detail={tva ? tva.mention : 'régime à trancher avec le comptable — regimeTva()'}
          ton={tva ? 'bon' : 'attente'}
        />
      </div>

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={['Numéro', 'Émise le', 'Client', 'Objet', 'Montant', 'Facture']}
            largeurMin="56rem"
          >
            {liste.map((f) => (
              <tr key={f.id} className="border-b border-filet last:border-0">
                <td className="py-2.5 pr-4 font-mono tabular-nums">{f.numero}</td>
                <td className="py-2.5 pr-4 whitespace-nowrap text-encre-doux">
                  {dateCourte(f.emise_at)}
                </td>
                <td className="py-2.5 pr-4">
                  {[f.orders?.profiles?.prenom, f.orders?.profiles?.nom]
                    .filter(Boolean)
                    .join(' ') || '—'}
                  <span className="block text-xs text-encre-faible">
                    {f.orders?.profiles?.email}
                  </span>
                </td>
                <td className="py-2.5 pr-4">{f.orders?.formations?.titre ?? '—'}</td>
                <td className="py-2.5 pr-4 tabular-nums">
                  {f.orders ? formaterMontant(f.orders.montant_cents, f.orders.devise) : '—'}
                </td>
                <td className="py-2.5">
                  <a
                    href={`/facture/${f.id}`}
                    target="_blank"
                    rel="noopener"
                    className="text-accent hover:underline"
                  >
                    Ouvrir
                  </a>
                </td>
              </tr>
            ))}
          </Tableau>
        </div>
      ) : (
        <Vide>Aucune facture. Elles sont émises automatiquement à chaque paiement encaissé.</Vide>
      )}
    </>
  );
}
