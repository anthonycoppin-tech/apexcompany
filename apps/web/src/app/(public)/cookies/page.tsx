import { METADONNEES_LEGALES, PageLegale } from '@/components/page-legale';
import { Carte } from '@/components/ui';

export const metadata = { title: 'Politique de cookies', ...METADONNEES_LEGALES };

/**
 * `/cookies`.
 *
 * Le fait notable se vérifie en une recherche dans le dépôt, et il vaut la
 * peine d'être dit maintenant : **il n'y a aucun traceur**. Pas de mesure
 * d'audience, pas de pixel publicitaire, aucune dépendance qui en pose un. Les
 * seuls cookies sont ceux de la session Supabase, sans lesquels on ne peut pas
 * rester connecté.
 *
 * C'est aussi ce qui explique l'absence de bandeau de consentement : il n'y a
 * rien à consentir. Si un outil de mesure arrive un jour, c'est cette phrase
 * qui devient fausse en premier — et le bandeau devient obligatoire avec elle.
 */
export default function Page() {
  return (
    <PageLegale
      titre="Politique de cookies"
      contiendra="Quels cookies sont déposés, par qui, pour quoi faire, et comment les refuser."
    >
      <Carte className="space-y-3">
        <h2 className="font-semibold">Ce qui est déjà vrai aujourd’hui</h2>
        <p className="leading-relaxed text-encre-doux">
          Ce site ne dépose{' '}
          <strong className="text-encre">aucun cookie de mesure d’audience</strong> et{' '}
          <strong className="text-encre">aucun traceur publicitaire</strong>. Il n’y a ni Google
          Analytics, ni pixel de réseau social, ni outil équivalent.
        </p>
        <p className="leading-relaxed text-encre-doux">
          Les seuls cookies déposés servent à vous garder connecté à votre espace. Ils sont
          indispensables au fonctionnement du site : sans eux, chaque page vous redemanderait de
          vous identifier. C’est aussi pour cette raison qu’aucun bandeau ne vous est présenté — il
          n’y a rien à accepter ou à refuser.
        </p>
      </Carte>
    </PageLegale>
  );
}
