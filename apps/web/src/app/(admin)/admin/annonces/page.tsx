import Link from 'next/link';

import { EnTete, Pastille, Tableau, Vide, type Ton } from '@/components/admin';
import { dateCourte } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Annonces' };

/**
 * `/admin/annonces` — les événements annoncés en tête de l'accueil.
 *
 * L'état se lit d'un coup d'œil, et il en a trois : en ligne, brouillon, et
 * **échue** — publiée mais passée, donc invisible du site sans que personne ait
 * rien fait. C'est la politique RLS qui la retire, pas cet écran.
 */
export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('annonces')
    .select('id, titre, date_evenement, publiee, fin_affichage')
    .order('fin_affichage', { ascending: false });

  const maintenant = new Date().getTime();
  const liste = (data ?? []).map((a) => {
    const echue = new Date(a.fin_affichage).getTime() <= maintenant;
    const [etat, ton]: [string, Ton] = echue
      ? ['Échue', 'neutre']
      : a.publiee
        ? ['En ligne', 'bon']
        : ['Brouillon', 'attente'];
    return { ...a, etat, ton, enLigne: a.publiee && !echue };
  });
  const enLigne = liste.filter((a) => a.enLigne).length;

  return (
    <>
      <EnTete
        titre="Annonces"
        description={`Le bandeau d’événement en tête de l’accueil · ${enLigne} en ligne`}
        action={
          <Link
            href="/admin/annonces/nouvelle"
            className="rounded-douce bg-accent px-4 py-2 text-sm font-semibold text-accent-contraste hover:bg-accent-fort"
          >
            Nouvelle annonce
          </Link>
        }
      />

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={['Titre', 'Événement', 'Affichée jusqu’au', 'État']}
            largeurMin="40rem"
          >
            {liste.map((a) => (
              <tr key={a.id} className="border-b border-filet last:border-0">
                <td className="py-2.5 pr-4">
                  <Link href={`/admin/annonces/${a.id}`} className="font-medium hover:underline">
                    {a.titre}
                  </Link>
                </td>
                <td className="py-2.5 pr-4 text-encre-doux">
                  {a.date_evenement ? dateCourte(`${a.date_evenement}T12:00:00Z`) : '—'}
                </td>
                <td className="py-2.5 pr-4 text-encre-doux">
                  {dateCourte(new Date(new Date(a.fin_affichage).getTime() - 1).toISOString())}
                </td>
                <td className="py-2.5">
                  <Pastille ton={a.ton}>{a.etat}</Pastille>
                </td>
              </tr>
            ))}
          </Tableau>
        </div>
      ) : (
        <Vide>Aucune annonce. L’accueil s’affiche alors sans bandeau.</Vide>
      )}
    </>
  );
}
