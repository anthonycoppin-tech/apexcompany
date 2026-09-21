import { Article, DocumentLegal } from '@/components/document-legal';
import { Carte } from '@/components/ui';
import { SOCIETE } from '@/lib/legal/societe';

export const metadata = {
  title: 'Rétractation et remboursement',
  description: 'Droit de rétractation de quatorze jours, remboursements et formulaire type.',
};

/**
 * `/remboursement`.
 *
 * Reprise de la politique de l'ancien site, alignée sur l'article 8 des CGV —
 * les deux textes disent la même chose, et c'est la CGV qui fait foi.
 *
 * Deux ajouts : le **formulaire type de rétractation**, que le vendeur doit
 * mettre à disposition du consommateur et que l'ancien site ne donnait pas ; et
 * la règle de calcul au prorata pour un service commencé, que l'ancienne grille
 * remplaçait par « aucun remboursement dès la première séance ».
 *
 * Le calcul au prorata s'exécute tel quel depuis le back-office : les
 * remboursements partiels existent (`/admin/paiements/remboursements`).
 */
export default function Page() {
  const email = <a href={`mailto:${SOCIETE.email}`}>{SOCIETE.email}</a>;

  return (
    <DocumentLegal
      titre="Rétractation et remboursement"
      chapeau={
        <p>
          Ce que vous pouvez récupérer, dans quels cas, et comment le demander. Cette page reprend
          l’article 8 des{' '}
          <a href="/cgv#retractation" className="text-accent underline">
            conditions générales de vente
          </a>
          , qui fait foi.
        </p>
      }
    >
      <Article titre="Quatorze jours pour changer d’avis">
        <p>
          Si vous achetez en tant que consommateur, vous disposez de quatorze jours à compter du
          paiement pour vous rétracter, sans avoir à vous justifier ni à supporter d’autres frais
          que ceux indiqués ci-dessous.
        </p>
        <p>
          Tous nos programmes commencent dès le paiement, parce que vous le demandez expressément en
          cochant la case prévue. Ce que devient votre droit dépend du programme :
        </p>
        <ul>
          <li>
            <strong>Formation</strong> : l’accès est immédiat et vous avez reconnu perdre votre
            droit de rétractation dès son ouverture. Aucun remboursement n’est donc dû au titre de
            la rétractation une fois l’accès ouvert.
          </li>
          <li>
            <strong>Accompagnement et abonnement</strong> : vous pouvez vous rétracter pendant
            quatorze jours. Nous conservons la part correspondant à la période écoulée jusqu’à votre
            demande, et vous remboursons le reste.
          </li>
        </ul>
        <p>
          <strong>Le calcul</strong> : prix payé × jours écoulés ÷ jours de la période achetée. Par
          exemple, pour un accompagnement de trois mois (90 jours) payé 900 €, une rétractation au 6
          <sup>e</sup> jour laisse 60 € dus et donne lieu à un remboursement de 840 €.
        </p>
      </Article>

      <Article titre="Comment vous rétracter">
        <p>
          Écrivez à {email} avant la fin du délai, en indiquant votre nom, la date ou la référence
          de l’achat, et votre volonté de vous rétracter. Vous pouvez utiliser le formulaire
          ci-dessous, sans obligation. Nous accusons réception de votre demande par email.
        </p>
      </Article>

      <Article titre="Le remboursement">
        <p>
          Il est effectué dans les quatorze jours suivant la réception de votre demande, par le même
          moyen de paiement que celui utilisé pour l’achat, sans frais pour vous. Selon votre
          banque, quelques jours supplémentaires peuvent s’écouler avant que la somme n’apparaisse
          sur votre compte. La rétractation met fin à votre accès au programme, et à l’abonnement
          s’il s’agit d’un abonnement.
        </p>
      </Article>

      <Article titre="En dehors du délai de rétractation">
        <p>Un remboursement peut aussi être accordé, sur demande justifiée, en cas :</p>
        <ul>
          <li>de double paiement involontaire ;</li>
          <li>d’erreur technique ayant empêché l’accès au programme ;</li>
          <li>
            de toute autre situation examinée au cas par cas, avant consommation du programme.
          </li>
        </ul>
        <p>
          La résiliation d’un abonnement, elle, ne donne pas lieu à remboursement : elle prend effet
          à la fin de la période déjà payée, et votre accès reste ouvert jusque-là.
        </p>
      </Article>

      <Article titre="En cas de désaccord">
        <p>
          Écrivez-nous d’abord à {email} : nous cherchons une solution amiable. Si elle n’aboutit
          pas, vous pouvez recourir gratuitement à un médiateur de la consommation, ou saisir les
          juridictions de votre lieu de résidence (article 13 des{' '}
          <a href="/cgv#litiges">conditions générales de vente</a>).
        </p>
      </Article>

      <Article id="formulaire" titre="Formulaire type de rétractation">
        <p>À recopier dans un email, compléter et envoyer à {email}.</p>
        <Carte className="space-y-3 text-sm leading-relaxed text-encre">
          <p>
            À l’attention de {SOCIETE.raisonSociale}, {SOCIETE.adresse} — {SOCIETE.email}
          </p>
          <p>
            Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de
            services ou la fourniture de contenu numérique ci-dessous :
          </p>
          <ul className="list-none space-y-1 pl-0">
            <li>Programme : …</li>
            <li>Acheté le : …</li>
            <li>Nom et prénom : …</li>
            <li>Adresse email du compte : …</li>
            <li>Date : …</li>
          </ul>
        </Carte>
      </Article>
    </DocumentLegal>
  );
}
