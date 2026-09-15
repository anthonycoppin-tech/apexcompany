import { Bouton, Carte, Conteneur } from '@/components/ui';

export const metadata = {
  title: 'Événements présentiels',
  robots: { index: false, follow: true },
};

/**
 * `/evenements`.
 *
 * La page affichait « Placeholder — écran à construire. Voir docs/02-SITEMAP.md »,
 * publiquement. C'est le défaut corrigé le 13 septembre sur les six pages
 * légales, resté ici : elle n'était pas dans la liste parce qu'elle n'est pas
 * juridique, alors qu'elle est publique exactement de la même façon.
 *
 * Elle n'est liée depuis aucune navigation, mais une page non liée reste une
 * page servie à qui connaît son adresse — et `sitemap.ts` documente déjà son
 * absence volontaire du plan de site. Le `noindex` posé ici est la seconde
 * barrière, celle qui tient le jour où `robots.txt` s'ouvrira : sans elle, la
 * page entrerait dans l'index en annonçant qu'elle est vide.
 *
 * Le contenu n'est pas inventé pour autant. Ce que `02-SITEMAP.md` tranche est
 * dit — les événements sont reportés après la première livraison, et la
 * billetterie sera externe, sans gestion de réservation dans la plateforme.
 * Le reste (dates, lieux, tarifs) n'existe pas et n'est donc pas annoncé.
 *
 * Elle ne laisse pas non plus le visiteur sans issue : c'est le même principe
 * que `PageLegale`, mais l'issue n'est pas la même. Quelqu'un qui cherche un
 * événement cherche à rencontrer l'équipe ; ce qui existe aujourd'hui pour ça,
 * c'est l'échange d'orientation.
 */
export default function Page() {
  return (
    <Conteneur largeur="moyenne" className="space-y-8 py-16 sm:py-24">
      <div className="space-y-4">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Événements présentiels</h1>
        <p className="text-lg leading-relaxed text-encre-doux">
          Les rencontres en présentiel, leurs dates, leurs lieux et le moyen d’y prendre sa place.
        </p>
      </div>

      <Carte className="space-y-3">
        <p className="font-semibold">Il n’y a pas d’événement annoncé pour l’instant.</p>
        <p className="leading-relaxed text-encre-doux">
          Cette page ouvrira quand une première date sera fixée. La réservation se fera par une
          billetterie externe : nous ne gérons pas les places depuis le site.
        </p>
        <p className="leading-relaxed text-encre-doux">
          D’ici là, le moyen de nous rencontrer est l’échange d’orientation — trente minutes, en
          visio, offertes et sans engagement.
        </p>
      </Carte>

      <div className="flex flex-wrap gap-3">
        <Bouton href="/qualification">Faire le point sur ma situation</Bouton>
        <Bouton href="/contact" variante="secondaire">
          Nous écrire
        </Bouton>
      </div>
    </Conteneur>
  );
}
