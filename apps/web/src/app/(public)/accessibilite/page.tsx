import { METADONNEES_LEGALES, PageLegale } from '@/components/page-legale';
import { Carte } from '@/components/ui';

export const metadata = { title: 'Déclaration d’accessibilité', ...METADONNEES_LEGALES };

/**
 * `/accessibilite`.
 *
 * Une déclaration d'accessibilité annonce un **taux de conformité mesuré**.
 * Aucun audit n'a eu lieu : écrire un pourcentage ici serait inventer le
 * résultat d'un test qu'on n'a pas fait, ce qui est exactement le reproche
 * qu'on adresse à une déclaration de complaisance.
 *
 * Ce qu'on peut dire sans audit, c'est ce qui a été fait — et le dire n'est pas
 * une déclaration de conformité.
 */
export default function Page() {
  return (
    <PageLegale
      titre="Déclaration d’accessibilité"
      contiendra="Le résultat de l’audit d’accessibilité, le taux de conformité obtenu, les points encore non conformes, et le moyen de nous signaler une difficulté."
    >
      <Carte className="space-y-3">
        <h2 className="font-semibold">Ce qui a été fait, sans audit à ce jour</h2>
        <p className="leading-relaxed text-encre-doux">
          Le site est construit en HTML natif — titres hiérarchisés, formulaires avec étiquettes
          liées, langue déclarée, lien d’évitement vers le contenu en début de page. Les couleurs
          passent toutes par un jeu de tokens commun, ce qui permet de reprendre les contrastes en
          un seul endroit le jour où la charte graphique arrive.
        </p>
        <p className="leading-relaxed text-encre-doux">
          Rien de tout cela n’a été vérifié par un audit, et ce n’est donc pas une déclaration de
          conformité. Si une page vous bloque, écrivez-nous : c’est le signalement le plus utile que
          nous puissions recevoir, et il sera traité avant l’audit.
        </p>
      </Carte>
    </PageLegale>
  );
}
