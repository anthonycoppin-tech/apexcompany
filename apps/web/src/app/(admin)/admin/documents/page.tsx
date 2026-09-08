import { formaterMontant } from '@apex/db';

import { EnTete, Pastille, Tableau, Tuile, Vide } from '@/components/admin';
import { dateCourte } from '@/lib/format';
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
 * Le PDF, lui, n'est pas encore généré : la colonne existe, le fichier non.
 * Tant que c'est le cas, la ligne reste lisible plutôt que d'offrir un lien
 * mort.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: factures } = await supabase
    .from('invoices')
    .select(
      'id, numero, emise_at, pdf_url, orders(montant_cents, devise, formations(titre), profiles(prenom, nom, email))',
    )
    .order('emise_at', { ascending: false })
    .limit(200);

  const liste = factures ?? [];
  const total = liste.reduce((t, f) => t + (f.orders?.montant_cents ?? 0), 0);
  const sansPdf = liste.filter((f) => !f.pdf_url).length;

  return (
    <>
      <EnTete titre="Factures" description={`${liste.length} émises`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tuile libelle="Total facturé" valeur={formaterMontant(total)} />
        <Tuile
          libelle="Sans PDF"
          valeur={String(sansPdf)}
          detail="la génération reste à écrire"
          ton={sansPdf > 0 ? 'attente' : 'bon'}
        />
      </div>

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={['Numéro', 'Émise le', 'Client', 'Objet', 'Montant', 'PDF']}
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
                  {f.pdf_url ? (
                    <a href={f.pdf_url} className="text-accent hover:underline">
                      Ouvrir
                    </a>
                  ) : (
                    <Pastille ton="attente">à générer</Pastille>
                  )}
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
