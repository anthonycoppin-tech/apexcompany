import { Article, DocumentLegal } from '@/components/document-legal';
import { SOCIETE } from '@/lib/legal/societe';

export const metadata = {
  title: 'Politique de confidentialité',
  description:
    'Données collectées, finalités, durées de conservation, destinataires et exercice de vos droits.',
};

/**
 * `/confidentialite`.
 *
 * Reprise de la politique de l'ancien site, dont presque tout le concret était
 * devenu faux pour celui-ci : ses sous-traitants (Whop, TAP Payments,
 * Circle.so, Zoom, Brevo, Google Workspace, Netlify) ne sont pas ceux de ce
 * site, et ses données collectées ignoraient le formulaire d'orientation, le
 * compte Discord et les notes des formateurs.
 *
 * **Ce qui est décrit ici se vérifie dans le code**, et l'inventaire complet,
 * table par table, est dans `/admin/legal`. Il se relit à chaque migration qui
 * touche une donnée personnelle — et cette page avec lui.
 *
 * La version précédente de cette page affirmait « votre adresse IP n'est pas
 * enregistrée ». C'était vrai quand elle a été écrite, et faux depuis le
 * 16 septembre (`consents.ip`) : c'est exactement la façon dont un texte de ce
 * genre devient faux sans que personne ne le voie.
 */
const COLLECTE: Array<{ quand: string; quoi: string }> = [
  {
    quand: 'Quand vous remplissez le formulaire d’orientation',
    quoi: 'Votre prénom, votre nom, votre adresse email, votre numéro de téléphone, et vos réponses aux questions posées — région, tranche d’âge, situation professionnelle, expérience du trading, objectif, difficulté principale, budget envisagé, échéance. Rien n’est enregistré si vous abandonnez le formulaire avant la fin.',
  },
  {
    quand: 'À votre arrivée sur le site',
    quoi: 'Si vous venez d’un lien de campagne ou d’un réseau social, le nom de ce réseau et les paramètres du lien, lus dans l’adresse de la page — pour savoir ce qui vous a amené ici. Aucune mesure d’audience ne tourne sur ce site.',
  },
  {
    quand: 'Quand vous prenez rendez-vous et êtes accompagné',
    quoi: 'La date du rendez-vous, son issue, le compte rendu du formateur, les propositions qui vous sont faites et les notes de suivi de votre formateur. Certaines notes vous sont visibles dans votre espace ; toutes vous sont communicables sur demande.',
  },
  {
    quand: 'Quand vous reliez votre compte Discord',
    quoi: 'Votre identifiant et votre pseudonyme Discord, et les rôles qui vous ont été attribués — pour vous donner accès aux espaces auxquels vous avez droit, et les retirer quand l’accès prend fin.',
  },
  {
    quand: 'Quand vous payez',
    quoi: 'Le programme acheté, le montant, les dates, les références de la transaction, la facture, et le cas échéant les remboursements et contestations. Votre numéro de carte ne nous parvient jamais : il est saisi chez Stripe.',
  },
  {
    quand: 'Quand vous acceptez nos textes',
    quoi: 'La date, la version du texte accepté et l’adresse IP de la connexion — lors de la création de votre compte, puis lors de chaque achat (conditions générales de vente et demande de démarrage immédiat). C’est ce qui permet d’établir à quoi vous avez consenti.',
  },
  {
    quand: 'Quand nous vous écrivons',
    quoi: 'Le registre des emails automatiques qui vous ont été envoyés, leur date, et s’ils ont été remis ou refusés par votre messagerie.',
  },
];

const FINALITES: Array<{ finalite: string; base: string }> = [
  {
    finalite: 'Créer votre compte, préparer et tenir l’échange d’orientation',
    base: 'Mesures précontractuelles prises à votre demande (art. 6.1.b RGPD)',
  },
  {
    finalite:
      'Vendre, ouvrir et retirer vos accès, vous accompagner, vous écrire à propos de votre programme',
    base: 'Exécution du contrat (art. 6.1.b)',
  },
  { finalite: 'Facturer et tenir la comptabilité', base: 'Obligation légale (art. 6.1.c)' },
  {
    finalite:
      'Prouver vos acceptations et l’ouverture de vos accès, traiter les contestations de paiement',
    base: 'Intérêt légitime (art. 6.1.f) : pouvoir établir nos droits',
  },
  {
    finalite:
      'Savoir quels réseaux amènent nos clients, protéger le formulaire contre les inscriptions automatiques',
    base: 'Intérêt légitime (art. 6.1.f)',
  },
];

const PRESTATAIRES: Array<{ nom: string; role: string }> = [
  { nom: 'Supabase', role: 'base de données, comptes et connexion' },
  { nom: 'Vercel', role: 'hébergement du site' },
  { nom: 'Stripe', role: 'paiements, abonnements et remboursements' },
  { nom: 'Discord', role: 'communauté, séances de groupe et accès aux salons' },
  { nom: 'Cal.com', role: 'prise de rendez-vous' },
  { nom: 'Resend', role: 'envoi des emails automatiques' },
];

export default function Page() {
  const email = <a href={`mailto:${SOCIETE.email}`}>{SOCIETE.email}</a>;

  return (
    <DocumentLegal
      titre="Politique de confidentialité"
      chapeau={
        <p>
          Quelles données nous collectons, pourquoi, combien de temps nous les gardons, avec qui
          elles sont partagées, et comment exercer vos droits.
        </p>
      }
    >
      <Article titre="1. Responsable du traitement">
        <p>
          <strong>{SOCIETE.raisonSociale}</strong>, {SOCIETE.adresse}, licence n° {SOCIETE.licence}.
          Contact : {email}.
        </p>
        <p>
          Nous appliquons le règlement (UE) 2016/679 (RGPD) à nos clients résidant dans l’Union
          européenne, et le décret-loi fédéral émirien n° 45 de 2021 sur la protection des données
          personnelles.
        </p>
      </Article>

      <Article titre="2. Les données que nous collectons">
        <dl className="space-y-4">
          {COLLECTE.map((c) => (
            <div key={c.quand} className="space-y-1">
              <dt className="font-medium text-encre">{c.quand}</dt>
              <dd>{c.quoi}</dd>
            </div>
          ))}
        </dl>
        <p>
          Nos services sont réservés aux personnes majeures : le formulaire d’orientation refuse
          toute personne qui déclare avoir moins de dix-huit ans.
        </p>
      </Article>

      <Article titre="3. Pourquoi, et sur quelle base">
        <ul>
          {FINALITES.map((f) => (
            <li key={f.finalite}>
              <strong>{f.finalite}</strong> — {f.base}.
            </li>
          ))}
        </ul>
        <p>
          Nous ne vendons aucune donnée, n’en transmettons aucune à un annonceur, et ne vous
          envoyons aucune prospection commerciale sans votre accord.
        </p>
      </Article>

      <Article titre="4. Qui y a accès">
        <p>
          Au sein d’Apex, seules les personnes qui en ont besoin : l’équipe de direction et de
          support, et le formateur qui vous suit. Un formateur ne voit que les personnes qui lui
          sont confiées, et jamais ce que vous avez payé.
        </p>
        <p>Nos prestataires, chacun pour sa part :</p>
        <ul>
          {PRESTATAIRES.map((p) => (
            <li key={p.nom}>
              <strong>{p.nom}</strong> — {p.role}.
            </li>
          ))}
        </ul>
        <p>
          Vos échanges sur Discord sont hébergés par Discord et soumis à sa propre politique de
          confidentialité.
        </p>
      </Article>

      <Article titre="5. Transferts hors de l’Union européenne">
        <p>
          Apex est établie aux Émirats arabes unis, et plusieurs de ses prestataires aux États-Unis.
          Vos données sont donc traitées hors de l’Union européenne. Ces transferts sont encadrés
          par les clauses contractuelles types de la Commission européenne ou, pour les prestataires
          américains qui y adhèrent, par le cadre de protection des données UE–États-Unis.
        </p>
      </Article>

      <Article titre="6. Combien de temps">
        <ul>
          <li>
            <strong>Si vous n’achetez pas</strong> : trois ans après votre dernier contact avec
            nous, puis suppression de votre compte, de vos réponses, de vos rendez-vous et de vos
            consentements.
          </li>
          <li>
            <strong>Si vous êtes client</strong> : pendant toute la relation, puis trois ans après
            votre dernier achat ou votre dernier contact.
          </li>
          <li>
            <strong>Factures et pièces comptables</strong> : dix ans, y compris après une demande de
            suppression — la loi l’impose.
          </li>
          <li>
            <strong>Preuves d’acceptation</strong> : aussi longtemps que les pièces de la vente
            qu’elles concernent.
          </li>
        </ul>
      </Article>

      <Article titre="7. Vos droits">
        <p>
          Vous pouvez accéder à vos données, les faire rectifier ou effacer, en limiter le
          traitement, vous y opposer, en recevoir une copie dans un format réutilisable, retirer un
          consentement à tout moment, et, si vous résidez en France, définir des directives sur leur
          sort après votre décès.
        </p>
        <p>
          Écrivez à {email}. Nous répondons dans un délai d’un mois. Si la réponse ne vous satisfait
          pas, vous pouvez saisir l’autorité de protection des données de votre pays — en France, la
          CNIL (<a href="https://www.cnil.fr">cnil.fr</a>).
        </p>
      </Article>

      <Article titre="8. Sécurité">
        <p>
          Connexions chiffrées (HTTPS), cloisonnement des données au niveau de la base — chaque
          compte ne lit que ce qui le concerne —, accès de l’équipe limités à leur rôle, aucune
          donnée de carte conservée chez nous.
        </p>
      </Article>

      <Article titre="9. Cookies">
        <p>
          Aucun traceur publicitaire, aucune mesure d’audience. Le détail est sur la page{' '}
          <a href="/cookies">cookies</a>.
        </p>
      </Article>
    </DocumentLegal>
  );
}
