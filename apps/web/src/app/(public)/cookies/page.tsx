import { Article, DocumentLegal } from '@/components/document-legal';
import { SOCIETE } from '@/lib/legal/societe';

export const metadata = {
  title: 'Politique de cookies',
  description: 'Les seuls cookies déposés servent à vous garder connecté. Aucun traceur.',
};

/**
 * `/cookies`.
 *
 * La page de l'ancien site décrivait des cookies de mesure d'audience et de
 * marketing « lorsque applicable ». Ici, il n'y en a aucun — ça se vérifie en
 * une recherche dans le dépôt, et c'est ce qui dispense de bandeau de
 * consentement. Si un outil de mesure arrive un jour, c'est cette page qui
 * devient fausse en premier, et le bandeau devient obligatoire avec elle.
 *
 * Le réseau d'origine est lu dans l'adresse de la page, pas dans un cookie
 * (18 septembre) : il n'a rien à faire ici.
 */
export default function Page() {
  return (
    <DocumentLegal
      titre="Politique de cookies"
      chapeau={<p>Ce site ne dépose aucun traceur. Voici tout ce qu’il dépose.</p>}
    >
      <Article titre="1. Les cookies de ce site">
        <p>
          Les seuls cookies déposés par le site servent à <strong>vous garder connecté</strong> à
          votre espace. Ils portent le nom <code>sb-…-auth-token</code>, ne sont déposés qu’une fois
          connecté, et disparaissent à la déconnexion. Ils sont strictement nécessaires : sans eux,
          chaque page vous redemanderait de vous identifier. Ils ne demandent donc pas votre
          consentement.
        </p>
        <p>
          Il n’y a ni mesure d’audience, ni pixel de réseau social, ni cookie publicitaire. C’est
          pourquoi aucun bandeau ne vous est présenté : il n’y a rien à accepter ni à refuser.
        </p>
      </Article>

      <Article titre="2. Les services tiers">
        <p>
          Certaines étapes vous font passer par un autre service, qui applique sa propre politique
          de cookies :
        </p>
        <ul>
          <li>
            <strong>Cal.com</strong>, dont le calendrier s’affiche dans la page de prise de
            rendez-vous ;
          </li>
          <li>
            <strong>Whop</strong>, sur la page de paiement ;
          </li>
          <li>
            <strong>Discord</strong>, quand vous reliez votre compte.
          </li>
        </ul>
      </Article>

      <Article titre="3. Si cela change">
        <p>
          Si un outil de mesure d’audience ou de publicité était un jour ajouté, il ne serait activé
          qu’après votre accord, recueilli par un bandeau, et cette page serait mise à jour avant.
        </p>
      </Article>

      <Article titre="4. Contact">
        <p>
          <a href={`mailto:${SOCIETE.email}`}>{SOCIETE.email}</a>
        </p>
      </Article>
    </DocumentLegal>
  );
}
