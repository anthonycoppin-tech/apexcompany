import Link from 'next/link';

import { EnTete, Pastille, Tableau, Vide } from '@/components/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * `/admin/temoignages` — les paroles de clients affichées sur le site.
 *
 * Deux colonnes portent tout l'intérêt de cet écran :
 *
 * **Le consentement.** Sans lui, la publication est refusée — ici comme en base.
 * Un témoignage recueilli mais pas encore autorisé se voit d'un coup d'œil, et
 * c'est le seul état où l'on a du travail à faire (demander l'accord).
 *
 * **L'état.** Brouillon et publié cohabitent dans la même table : c'est le seul
 * endroit du schéma où c'est le cas, et la RLS garantit qu'un visiteur anonyme
 * ne voit jamais que le second.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: temoignages } = await supabase
    .from('temoignages')
    .select('id, auteur, contexte, contenu, note, consentement, publie, ordre, formations(titre)')
    .order('ordre');

  const liste = temoignages ?? [];
  const publies = liste.filter((t) => t.publie).length;
  const sansAccord = liste.filter((t) => !t.consentement).length;

  return (
    <>
      <EnTete
        titre="Témoignages"
        description={`${publies} publié${publies > 1 ? 's' : ''} sur ${liste.length}`}
        action={
          <Link
            href="/admin/temoignages/nouveau"
            className="rounded-douce bg-accent px-4 py-2 text-sm font-semibold text-accent-contraste hover:bg-accent-fort"
          >
            Nouveau témoignage
          </Link>
        }
      />

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={['Auteur', 'Contexte', 'Programme', 'Note', 'Accord', 'État']}
            largeurMin="60rem"
          >
            {liste.map((t) => (
              <tr key={t.id} className="border-b border-filet last:border-0">
                <td className="py-2.5 pr-4">
                  <Link href={`/admin/temoignages/${t.id}`} className="font-medium hover:underline">
                    {t.auteur}
                  </Link>
                  <span className="block max-w-md truncate text-xs text-encre-faible">
                    {t.contenu}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-encre-doux">{t.contexte ?? '—'}</td>
                <td className="py-2.5 pr-4 text-encre-doux">{t.formations?.titre ?? '—'}</td>
                <td className="py-2.5 pr-4 tabular-nums">{t.note ? `${t.note}/5` : '—'}</td>
                <td className="py-2.5 pr-4">
                  <Pastille ton={t.consentement ? 'bon' : 'probleme'}>
                    {t.consentement ? 'obtenu' : 'manquant'}
                  </Pastille>
                </td>
                <td className="py-2.5">
                  <Pastille ton={t.publie ? 'bon' : 'neutre'}>
                    {t.publie ? 'Publié' : 'Brouillon'}
                  </Pastille>
                </td>
              </tr>
            ))}
          </Tableau>
        </div>
      ) : (
        <Vide>Aucun témoignage pour l’instant.</Vide>
      )}

      <p className="text-sm text-encre-doux">
        Un témoignage ne se publie pas sans accord écrit de son auteur : ce sont son nom et ses
        mots.
        {sansAccord > 0 &&
          ` ${sansAccord} en attend un — ils restent invisibles du site en attendant.`}
      </p>
    </>
  );
}
