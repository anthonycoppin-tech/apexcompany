import Link from 'next/link';
import type { ReactNode } from 'react';

import { Carte, Conteneur } from '@/components/ui';

/**
 * La coquille des six pages légales, tant qu'elles ne sont pas écrites.
 *
 * **Ce composant ne rédige rien.** Il n'y a pas de texte juridique ici, et il
 * n'y en aura pas : ni l'identité de la société qui vend, ni son régime de TVA,
 * ni le droit de la consommation applicable ne sont connus (`08-CE-QUI-MANQUE`),
 * et personne dans l'équipe n'est juriste. Un modèle recopié depuis un
 * générateur engagerait la société sur des clauses que personne n'a lues.
 *
 * Ce qu'il corrige est plus modeste, et n'attendait personne : ces six pages
 * affichaient « Placeholder — écran à construire. Voir docs/02-SITEMAP.md ».
 * C'était public, et `/confidentialite` est liée depuis trois formulaires — la
 * qualification, la souscription et le contact. La personne qui cliquait pour
 * savoir ce qu'on fait de ses données lisait un chemin de dépôt interne.
 *
 * Trois principes :
 *
 * - **dire ce que la page contiendra**, pour que le visiteur sache s'il doit
 *   revenir ou nous écrire tout de suite ;
 * - **ne laisser aucune page sans issue** : un contact, toujours ;
 * - **ce qu'on sait déjà se dit**, quand c'est vrai et vérifiable — la liste des
 *   services chez qui les données transitent, par exemple, se lit dans le code.
 *   Ce qui se décide (durées, bases légales, rétractation) n'est pas affirmé.
 *
 * Enfin, chaque page se retire de l'indexation tant qu'elle est dans cet état,
 * via `METADONNEES_LEGALES`. `robots.txt` interdit déjà tout le site en
 * l'absence de domaine HTTPS, mais il l'ouvrira le jour de la mise en ligne :
 * sans cette seconde barrière, ces six pages entreraient dans l'index en
 * annonçant qu'elles sont vides. Le garde-fou se retire en même temps que le
 * contenu arrive, ce qui est le bon couplage.
 */
export const METADONNEES_LEGALES = {
  robots: { index: false, follow: true },
} as const;

export function PageLegale({
  titre,
  contiendra,
  children,
}: {
  titre: string;
  /** Ce que la page dira une fois écrite, en une phrase. */
  contiendra: string;
  /** Ce qu'on peut déjà affirmer sans risque. Facultatif. */
  children?: ReactNode;
}) {
  return (
    <Conteneur largeur="moyenne" className="space-y-8 py-16 sm:py-24">
      <div className="space-y-4">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{titre}</h1>
        <p className="text-lg leading-relaxed text-encre-doux">{contiendra}</p>
      </div>

      <Carte className="space-y-3">
        <p className="font-semibold">Cette page n’est pas encore publiée.</p>
        <p className="leading-relaxed text-encre-doux">
          Elle le sera avant la première vente. Nous préférons cette phrase à un texte recopié
          ailleurs : des conditions qu’on n’a pas écrites sont des engagements qu’on ne tiendra pas.
        </p>
        <p className="leading-relaxed text-encre-doux">
          D’ici là, toute question sur ce point trouve une réponse écrite si vous nous la posez —{' '}
          <Link href="/contact" className="font-medium text-accent hover:underline">
            la page contact
          </Link>{' '}
          est relevée.
        </p>
      </Carte>

      {children}
    </Conteneur>
  );
}
