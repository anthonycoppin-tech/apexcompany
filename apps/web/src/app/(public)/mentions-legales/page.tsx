import { Article, DocumentLegal } from '@/components/document-legal';
import { HEBERGEUR_DONNEES, HEBERGEUR_SITE, SOCIETE } from '@/lib/legal/societe';

export const metadata = {
  title: 'Mentions légales',
  description: `Éditeur du site, hébergement et propriété intellectuelle — ${SOCIETE.raisonSociale}.`,
};

/**
 * `/mentions-legales`.
 *
 * Reprise de la page de l'ancien site, avec deux corrections : l'objet du site
 * y était décrit comme « psychologie personnelle, stabilité intérieure et
 * discipline », alors que les CGV de la même société et tout le site actuel
 * parlent de formation au trading — un texte légal qui décrit une autre
 * activité que celle vendue ne protège de rien. Et l'hébergeur n'est plus
 * Netlify.
 *
 * La liste des huit activités déclarées sur la licence n'est pas reprise : elle
 * n'est pas exigée ici, et elle se périme à chaque renouvellement.
 */
export default function Page() {
  return (
    <DocumentLegal titre="Mentions légales">
      <Article titre="Éditeur du site">
        <p>
          Le site est édité par <strong>{SOCIETE.raisonSociale}</strong>, {SOCIETE.forme},
          immatriculée en {SOCIETE.zoneFranche}, exploitant le nom commercial «{' '}
          {SOCIETE.nomCommercial} ».
        </p>
        <ul>
          <li>Siège : {SOCIETE.adresse}</li>
          <li>Numéro de licence : {SOCIETE.licence}</li>
          <li>Numéro d’immatriculation : {SOCIETE.immatriculation}</li>
          <li>Numéro d’enregistrement fiscal (TRN) : {SOCIETE.trn}</li>
          <li>Téléphone : {SOCIETE.telephone}</li>
          <li>
            Email : <a href={`mailto:${SOCIETE.email}`}>{SOCIETE.email}</a>
          </li>
        </ul>
      </Article>

      <Article titre="Directeur de la publication">
        <p>{SOCIETE.dirigeant}, en qualité de gérant (manager) de la société.</p>
      </Article>

      <Article titre="Hébergement">
        <p>
          Le site est hébergé par <strong>{HEBERGEUR_SITE.nom}</strong>, {HEBERGEUR_SITE.adresse} —{' '}
          <a href={HEBERGEUR_SITE.site}>{HEBERGEUR_SITE.site.replace('https://', '')}</a>.
        </p>
        <p>
          Les comptes et les données sont hébergés par <strong>{HEBERGEUR_DONNEES.nom}</strong>,{' '}
          {HEBERGEUR_DONNEES.adresse} —{' '}
          <a href={HEBERGEUR_DONNEES.site}>{HEBERGEUR_DONNEES.site.replace('https://', '')}</a>.
        </p>
      </Article>

      <Article titre="Objet du site">
        <p>
          Le site présente et commercialise des programmes de formation au trading : analyse des
          marchés, gestion du risque, psychologie et discipline de l’exécution, accompagnement
          individuel et communauté d’apprentissage.
        </p>
        <p>
          Il s’agit d’une activité <strong>exclusivement éducative</strong>. Aucun contenu du site
          ne constitue un conseil en investissement, une recommandation d’achat ou de vente d’un
          instrument financier, ni une promesse de résultat. Voir l’
          <a href="/avertissement">avertissement sur les risques</a>.
        </p>
      </Article>

      <Article titre="Propriété intellectuelle">
        <p>
          Les textes, vidéos, supports, méthodes, marques et visuels présents sur le site et dans
          les programmes sont la propriété de {SOCIETE.raisonSociale} ou de ses partenaires, et sont
          protégés par le droit de la propriété intellectuelle. Toute reproduction, diffusion ou
          exploitation sans autorisation écrite préalable est interdite.
        </p>
      </Article>

      <Article titre="Responsabilité">
        <p>
          L’éditeur s’efforce d’assurer l’exactitude des informations publiées, sans pouvoir la
          garantir en toutes circonstances. Il ne garantit aucune progression individuelle, aucun
          résultat personnel ou financier, ni aucune réussite particulière.
        </p>
      </Article>

      <Article titre="Contact">
        <p>
          Pour toute question relative au site :{' '}
          <a href={`mailto:${SOCIETE.email}`}>{SOCIETE.email}</a>.
        </p>
      </Article>
    </DocumentLegal>
  );
}
