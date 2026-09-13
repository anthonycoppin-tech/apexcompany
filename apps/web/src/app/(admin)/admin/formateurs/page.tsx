import Link from 'next/link';

import { EnTete, Pastille, Tableau, Vide } from '@/components/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * `/admin/formateurs` — les fiches publiques de l'équipe.
 *
 * À ne pas confondre avec `/admin/utilisateurs`, qui gère les comptes et les
 * rôles. Ici on décide de ce qui s'affiche sur `/formateurs` ; là-bas on décide
 * de ce qu'une personne a le droit de faire. Le rattachement entre les deux est
 * facultatif et n'ouvre aucun accès.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: fiches } = await supabase
    .from('formateurs_fiches')
    .select('id, nom, fonction, biographie, specialites, photo_url, publie, ordre')
    .order('ordre');

  const liste = fiches ?? [];
  const publiees = liste.filter((f) => f.publie).length;

  return (
    <>
      <EnTete
        titre="Fiches formateurs"
        description={`${publiees} affichée${publiees > 1 ? 's' : ''} sur ${liste.length}`}
        action={
          <Link
            href="/admin/formateurs/nouveau"
            className="rounded-douce bg-accent px-4 py-2 text-sm font-semibold text-accent-contraste hover:bg-accent-fort"
          >
            Nouvelle fiche
          </Link>
        }
      />

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={['Nom', 'Fonction', 'Spécialités', 'Photo', 'État']}
            largeurMin="54rem"
          >
            {liste.map((f) => (
              <tr key={f.id} className="border-b border-filet last:border-0">
                <td className="py-2.5 pr-4">
                  <Link href={`/admin/formateurs/${f.id}`} className="font-medium hover:underline">
                    {f.nom}
                  </Link>
                  {/* Une fiche publiée sans biographie s'affiche vide sur la page
                      d'équipe : le signaler ici évite de le découvrir sur le site. */}
                  {!f.biographie && (
                    <span className="block text-xs text-encre-faible">sans biographie</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-encre-doux">{f.fonction ?? '—'}</td>
                <td className="py-2.5 pr-4 text-encre-doux">
                  {f.specialites.length ? f.specialites.join(', ') : '—'}
                </td>
                <td className="py-2.5 pr-4">
                  <Pastille ton={f.photo_url ? 'bon' : 'neutre'}>
                    {f.photo_url ? 'oui' : 'aucune'}
                  </Pastille>
                </td>
                <td className="py-2.5">
                  <Pastille ton={f.publie ? 'bon' : 'neutre'}>
                    {f.publie ? 'Affichée' : 'Brouillon'}
                  </Pastille>
                </td>
              </tr>
            ))}
          </Tableau>
        </div>
      ) : (
        <Vide>
          Aucune fiche. La page « L’équipe » explique le fonctionnement du suivi mais ne présente
          personne.
        </Vide>
      )}
    </>
  );
}
