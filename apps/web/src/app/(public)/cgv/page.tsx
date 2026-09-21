import { Article, DocumentLegal, SousTitre } from '@/components/document-legal';
import { SOCIETE } from '@/lib/legal/societe';

export const metadata = {
  title: 'Conditions générales de vente',
  description: `Conditions de vente des programmes ${SOCIETE.nomCommercial} : accès, prix, résiliation, rétractation.`,
};

/**
 * `/cgv`.
 *
 * Reprise des CGV de l'ancien site (version mai 2026), remises au
 * fonctionnement réel de celui-ci. Les écarts qui comptent, et pourquoi — le
 * détail est dans `docs/08-CE-QUI-MANQUE.md`, § informations juridiques :
 *
 * - **Trois produits, pas six.** Outils logiciels, agents automatisés et
 *   certification interne ne sont pas vendus ici.
 * - **La rétractation d'un service n'est pas éteinte par l'accès.** L'ancien
 *   texte l'éteignait « dès activation » pour tout. C'est vrai d'un contenu
 *   numérique (la formation), pas d'un service (accompagnement, abonnement) :
 *   le client qui a demandé un démarrage immédiat peut encore se rétracter, et
 *   doit alors la part déjà fournie.
 * - **La plateforme européenne de règlement en ligne des litiges n'existe
 *   plus** depuis le 20 juillet 2025. Le lien est retiré.
 * - **Le plafond de responsabilité au montant payé est retiré** : face à un
 *   consommateur, une clause qui réduit son droit à réparation est présumée
 *   abusive en droit français, et le reste du texte s'en trouverait fragilisé.
 * - **La résiliation se fait depuis l'espace client**, en plus de l'email.
 *
 * Chaque affirmation sur le fonctionnement (accès, impayé, résiliation) se
 * vérifie dans le code. Si le code change, ce texte change avec lui — et
 * `VERSION_TEXTES_LEGAUX` aussi.
 */
export default function Page() {
  const email = <a href={`mailto:${SOCIETE.email}`}>{SOCIETE.email}</a>;

  return (
    <DocumentLegal
      titre="Conditions générales de vente"
      chapeau={
        <p>
          Elles s’appliquent à tout achat effectué sur ce site. Vous les acceptez, avec l’
          <a href="/avertissement" className="text-accent underline">
            avertissement sur les risques
          </a>{' '}
          qui en fait partie, en cochant la case prévue avant de payer.
        </p>
      }
    >
      <Article id="vendeur" titre="1. Le vendeur">
        <p>
          <strong>{SOCIETE.raisonSociale}</strong>, {SOCIETE.forme}, immatriculée en{' '}
          {SOCIETE.zoneFranche} sous le numéro {SOCIETE.immatriculation}, licence n°{' '}
          {SOCIETE.licence}, dont le siège est situé {SOCIETE.adresse}. Représentée par{' '}
          {SOCIETE.dirigeant}.
        </p>
        <p>Contact : {email}.</p>
        <p>Dans les présentes, elle est désignée « Apex ».</p>
      </Article>

      <Article id="objet" titre="2. Objet et champ d’application">
        <p>
          Les présentes conditions régissent la vente, par Apex, de programmes de formation au
          trading à toute personne physique <strong>majeure</strong> (le « client »). Elles
          prévalent sur tout autre document, sauf accord écrit contraire.
        </p>
        <p>
          Les prestations sont <strong>exclusivement éducatives</strong>. Apex n’exerce aucune
          activité de conseil en investissement, de gestion de portefeuille, de réception ou
          d’exécution d’ordres, ni aucune activité réglementée par une autorité de supervision
          financière (voir l’article 9).
        </p>
      </Article>

      <Article id="prestations" titre="3. Les prestations">
        <p>Trois types de programmes sont proposés. Chaque fiche programme précise lequel.</p>
        <ul>
          <li>
            <strong>L’abonnement</strong> : un accès mensuel à la communauté et à ses contenus,
            renouvelé automatiquement chaque mois jusqu’à sa résiliation.
          </li>
          <li>
            <strong>L’accompagnement</strong> : un suivi par un formateur, individuel ou en groupe,
            pour une durée fixe d’un, trois ou six mois, payé en une fois.
          </li>
          <li>
            <strong>La formation</strong> : un programme payé en une fois, dont l’accès n’a pas de
            date de fin.
          </li>
        </ul>
        <p>
          Les programmes se déroulent en ligne. Les échanges, les séances de groupe et les contenus
          sont accessibles sur le serveur Discord d’Apex, auquel le client relie son compte depuis
          son espace personnel. Les séances individuelles d’un accompagnement sont organisées
          directement entre le client et son formateur.
        </p>
      </Article>

      <Article id="commande" titre="4. Commande">
        <p>Un programme s’achète de l’une de deux façons :</p>
        <ul>
          <li>
            <strong>après un échange d’orientation</strong> : le client remplit le formulaire
            d’orientation, prend rendez-vous, puis reçoit dans son espace une proposition
            personnalisée, à un prix qui peut différer du prix affiché au catalogue, et valable
            jusqu’à la date qu’elle indique ;
          </li>
          <li>
            <strong>directement</strong>, pour un abonnement, depuis sa fiche.
          </li>
        </ul>
        <p>
          Avant de payer, le client doit avoir confirmé son adresse email, accepter les présentes
          conditions et l’avertissement sur les risques, et demander expressément que son accès
          commence immédiatement (voir l’article 8). Le contrat est conclu à la confirmation du
          paiement. Apex conserve la trace de cette acceptation — date, version des textes acceptés
          et adresse IP.
        </p>
      </Article>

      <Article id="prix" titre="5. Prix et paiement">
        <p>
          Les prix sont indiqués en euros, toutes taxes comprises. Le prix applicable est celui
          affiché au moment de la commande, ou celui de la proposition personnalisée.
        </p>
        <p>
          Le paiement s’effectue par carte bancaire, par l’intermédiaire du prestataire de paiement
          Stripe. Apex n’a jamais connaissance des données de carte. Les formations et les
          accompagnements se paient en une fois, à la commande ; l’abonnement est prélevé chaque
          mois, à la date anniversaire de la souscription.
        </p>
        <p>
          Une facture est émise par {SOCIETE.raisonSociale} après chaque paiement et reste
          disponible dans l’espace client.
        </p>
      </Article>

      <Article id="acces" titre="6. Accès aux programmes">
        <p>
          L’accès s’ouvre dès que le paiement est confirmé : le programme apparaît dans l’espace
          client, et les rôles correspondants sont attribués sur Discord une fois le compte Discord
          relié. Apex conserve les journaux qui établissent l’ouverture de l’accès.
        </p>
        <p>
          Si l’accès n’apparaît pas dans les vingt-quatre heures suivant le paiement, le client
          écrit à {email}.
        </p>
      </Article>

      <Article id="duree" titre="7. Durée, renouvellement et résiliation">
        <SousTitre>Abonnement</SousTitre>
        <p>
          L’abonnement se renouvelle automatiquement chaque mois. Le client peut le résilier à tout
          moment, sans justification, <strong>depuis son espace</strong> (rubrique Factures) ou par
          email à {email}. La résiliation prend effet à la fin de la période déjà payée : l’accès
          reste ouvert jusque-là, et aucun prélèvement n’a lieu ensuite. La période en cours n’est
          pas remboursée, hors exercice du droit de rétractation.
        </p>
        <p>
          Si un prélèvement échoue, l’accès reste ouvert jusqu’à la fin de la période payée. Le
          client peut mettre à jour sa carte depuis son espace ; à défaut de régularisation, l’accès
          est retiré le lendemain de la fin de cette période.
        </p>
        <SousTitre>Accompagnement</SousTitre>
        <p>
          L’accès dure le nombre de mois achetés et prend fin sans démarche du client, le lendemain
          de sa date de fin. Racheter un accompagnement en cours prolonge l’accès au lieu de le
          remplacer. Passé le délai de rétractation, la période achetée reste due.
        </p>
        <SousTitre>Formation</SousTitre>
        <p>L’accès n’a pas de date de fin.</p>
        <SousTitre>Suspension pour manquement</SousTitre>
        <p>
          Apex peut suspendre ou résilier un accès, sans remboursement, en cas de manquement grave
          du client : partage de ses accès, reproduction ou diffusion des contenus, comportement
          portant atteinte aux autres membres ou à Apex. Le client en est informé par écrit, avec le
          motif.
        </p>
      </Article>

      <Article id="retractation" titre="8. Droit de rétractation">
        <p>
          Le client consommateur dispose d’un délai de <strong>quatorze jours</strong> à compter du
          paiement pour se rétracter, sans avoir à se justifier. Ce que devient ce droit dépend du
          programme, parce que tous les programmes commencent dès le paiement, à la demande expresse
          du client.
        </p>
        <SousTitre>Formation — contenu numérique</SousTitre>
        <p>
          En cochant la case prévue avant de payer, le client demande l’accès immédiat au programme
          et reconnaît qu’il{' '}
          <strong>perd son droit de rétractation dès que cet accès est ouvert</strong>.
        </p>
        <SousTitre>Accompagnement et abonnement — prestations de service</SousTitre>
        <p>
          En cochant la case prévue avant de payer, le client demande que la prestation commence
          avant la fin du délai de rétractation. Il{' '}
          <strong>conserve le droit de se rétracter</strong> pendant quatorze jours, et reste alors
          redevable de la part correspondant à la période écoulée jusqu’à sa demande : le prix payé,
          multiplié par le nombre de jours écoulés, divisé par le nombre de jours de la période
          achetée. Le reste lui est remboursé.
        </p>
        <SousTitre>Comment l’exercer</SousTitre>
        <p>
          Par email à {email}, avec le nom, la référence ou la date de l’achat, et la volonté claire
          de se rétracter. Le{' '}
          <a href="/remboursement#formulaire">formulaire type de rétractation</a> peut être utilisé,
          sans obligation. Le remboursement est effectué dans les quatorze jours suivant la
          réception de la demande, par le moyen de paiement utilisé lors de l’achat. Le détail est
          sur la page <a href="/remboursement">rétractation et remboursement</a>.
        </p>
      </Article>

      <Article id="nature" titre="9. Nature éducative et absence de conseil">
        <p>
          Les prestations d’Apex sont exclusivement éducatives. Elles ne constituent ni un conseil
          en investissement, personnalisé ou non, ni une recommandation d’acheter, de vendre ou de
          conserver un instrument financier, ni une gestion de portefeuille, ni un service de
          réception, de transmission ou d’exécution d’ordres. Apex n’est agréée par aucune autorité
          de supervision financière (notamment l’AMF ou l’ACPR en France, la SCA, la DFSA ou la VARA
          aux Émirats arabes unis) et n’exerce aucune activité qui le requerrait.
        </p>
        <p>
          Aucune séance, aucun contenu, aucun échange écrit ou oral ne peut être interprété comme
          une incitation à prendre position sur un marché. Apex n’a aucun accès aux comptes de
          trading de ses clients et ne reçoit aucun fonds destiné à être investi.
        </p>
        <p>
          Apex est tenue d’une obligation de moyens, non de résultat. Les marchés financiers
          comportent un risque élevé de perte, partielle ou totale, du capital engagé. Les
          performances passées, exemples et témoignages ne préjugent pas des résultats futurs. Toute
          décision d’investissement relève de la seule liberté et de la seule responsabilité du
          client. Voir l’<a href="/avertissement">avertissement sur les risques</a>.
        </p>
      </Article>

      <Article id="usage" titre="10. Usage des accès et propriété intellectuelle">
        <p>
          Les contenus, méthodes, supports, enregistrements, marques et concepts pédagogiques sont
          la propriété exclusive d’Apex. Le client reçoit une licence d’utilisation personnelle, non
          exclusive et non transférable, pour la durée de son accès.
        </p>
        <p>
          Sont interdits : le partage de ses accès, la reproduction, l’enregistrement, la diffusion
          ou la revente des contenus, et toute exploitation commerciale. Le client respecte
          également les règles du serveur Discord et les conditions d’utilisation de Discord.
        </p>
      </Article>

      <Article id="responsabilite" titre="11. Responsabilité">
        <p>Apex ne saurait être tenue responsable :</p>
        <ul>
          <li>des pertes subies par le client sur les marchés financiers ;</li>
          <li>de l’interprétation ou de l’usage que le client fait des contenus ;</li>
          <li>
            des actes ou des défaillances de tiers — courtiers, sociétés de financement, plateformes
            de trading ;
          </li>
          <li>
            des interruptions temporaires d’accès dues à une cause extérieure, notamment une panne
            de Discord ou d’un autre service tiers.
          </li>
        </ul>
        <p>
          Rien dans les présentes ne limite la responsabilité d’Apex au-delà de ce que permet la loi
          applicable au consommateur.
        </p>
      </Article>

      <Article id="donnees" titre="12. Données personnelles">
        <p>
          Apex traite les données du client conformément au règlement (UE) 2016/679 (RGPD) et au
          décret-loi fédéral émirien n° 45 de 2021 sur la protection des données personnelles. Le
          détail est dans la <a href="/confidentialite">politique de confidentialité</a>.
        </p>
      </Article>

      <Article id="litiges" titre="13. Réclamations et médiation">
        <p>
          Toute réclamation s’adresse d’abord à {email}. Apex s’engage à y répondre et à rechercher
          une solution amiable.
        </p>
        <p>
          À défaut d’accord, le client consommateur peut recourir gratuitement à un médiateur de la
          consommation. Les coordonnées du médiateur retenu par Apex lui sont communiquées sur
          demande à la même adresse.
        </p>
      </Article>

      <Article id="droit" titre="14. Droit applicable et juridiction">
        <p>
          Les présentes conditions sont régies par le droit des Émirats arabes unis, applicable à
          Dubaï et en Meydan Free Zone. Ce choix ne prive pas le client consommateur résidant dans
          l’Union européenne des protections que lui accordent les dispositions impératives du droit
          de son pays de résidence — notamment le droit de rétractation — ni de la possibilité de
          saisir les juridictions de son lieu de résidence.
        </p>
      </Article>

      <Article id="acceptation" titre="15. Acceptation">
        <p>En cochant les cases prévues et en validant son paiement, le client déclare :</p>
        <ul>
          <li>
            avoir lu et accepter les présentes conditions et l’avertissement sur les risques ;
          </li>
          <li>comprendre la nature exclusivement éducative des prestations ;</li>
          <li>reconnaître qu’aucun résultat, notamment financier, ne lui est promis ;</li>
          <li>assumer seul ses décisions d’investissement ;</li>
          <li>
            avoir été informé de son droit de rétractation et de ses conditions d’exercice, et
            demander que son accès commence immédiatement.
          </li>
        </ul>
      </Article>
    </DocumentLegal>
  );
}
