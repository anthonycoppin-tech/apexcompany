import { DonneesStructurees } from '@/components/donnees-structurees';
import { AvertissementRisque, Bouton, Conteneur, Section, Surtitre } from '@/components/ui';

export const metadata = {
  title: 'Questions fréquentes',
  description:
    'Le déroulé, les formats, l’accès Discord, la résiliation et les limites de ce que nous ' +
    'proposons.',
  alternates: { canonical: '/faq' },
};

/**
 * `/faq` — les questions qui arrivent au support si on n'y répond pas ici.
 *
 * Chaque réponse est vraie du produit tel qu'il est construit : le tunnel, les
 * trois types d'accès, Discord, la révocation en fin d'accès, la résiliation
 * depuis l'espace client. Rien n'y est promotionnel, et deux réponses disent
 * clairement ce que nous ne faisons pas — c'est ce qui rend les autres
 * crédibles.
 */
const RUBRIQUES: Array<{ titre: string; questions: Array<[string, string]> }> = [
  {
    titre: 'Avant de commencer',
    questions: [
      [
        'Comment se passe le premier contact ?',
        'Vous répondez à quelques questions sur votre situation, votre niveau et ce qui vous bloque — deux minutes. Vous accédez ensuite au calendrier pour réserver un échange d’orientation de trente minutes avec Franck.',
      ],
      [
        'L’échange d’orientation est-il payant ?',
        'Non, et il n’engage à rien. C’est un point sur votre situation, pas une présentation de produit. À l’issue, vous recevez une proposition écrite si un programme correspond — vous décidez ensuite, depuis votre espace.',
      ],
      [
        'Faut-il déjà savoir trader ?',
        'Non. Les programmes sont organisés par niveau, du parcours découverte à la pratique confirmée. C’est précisément ce que l’échange d’orientation permet de situer.',
      ],
      [
        'Faut-il avoir 18 ans ?',
        'Oui. Nos accompagnements ne sont pas ouverts aux mineurs, et le formulaire s’arrête dès cette question si vous en avez moins.',
      ],
      [
        'Faut-il un capital pour commencer ?',
        'Pas pour se former. Ce que vous engagez ensuite sur les marchés vous appartient, et nous n’intervenons jamais dessus : nous ne gérons aucun compte et ne recevons aucun fonds destiné à être investi.',
      ],
    ],
  },
  {
    titre: 'Pendant le programme',
    questions: [
      [
        'Où se déroulent les cours ?',
        'Sur un serveur Discord privé. Les sessions en direct se tiennent dans le salon vocal de votre programme, et les replays y restent disponibles. Votre accès est attribué automatiquement dès votre inscription.',
      ],
      [
        'Comment sont organisées les séances ?',
        'Les séances de groupe suivent un planning hebdomadaire annoncé sur Discord. Les séances individuelles s’organisent directement entre vous et votre formateur, au rythme qui vous convient.',
      ],
      [
        'Puis-je suivre deux programmes en même temps ?',
        'Oui. L’abonnement communauté et un accompagnement se cumulent sans difficulté : deux accès, deux échéances indépendantes, et les deux apparaissent dans votre espace.',
      ],
      [
        'Que se passe-t-il à la fin de mon accès ?',
        'L’accès au salon du programme se ferme automatiquement à la date de fin. Une formation achetée en une fois, elle, reste accessible sans limite de temps — il n’y a pas de date de fin à surveiller.',
      ],
    ],
  },
  {
    titre: 'Paiement et résiliation',
    questions: [
      [
        'Comment se fait le paiement ?',
        'Depuis votre espace, à partir de la proposition qui vous a été faite. Le paiement est sécurisé par Stripe : nous ne voyons jamais vos coordonnées bancaires. Une facture est émise automatiquement et reste disponible dans votre espace.',
      ],
      [
        'Puis-je résilier mon abonnement ?',
        'Oui, depuis votre espace, en deux clics et sans avoir à écrire à qui que ce soit. La résiliation prend effet à la fin de la période déjà réglée : vous gardez votre accès jusque-là, et aucun prélèvement n’est fait ensuite.',
      ],
      [
        'Et si un prélèvement échoue ?',
        'Votre accès n’est pas coupé immédiatement. Nous vous le signalons pour que vous puissiez mettre à jour votre moyen de paiement.',
      ],
    ],
  },
  {
    titre: 'Ce que nous ne faisons pas',
    questions: [
      [
        'Est-ce un conseil en investissement ?',
        'Non. Nous dispensons de la formation. Nous ne délivrons aucune recommandation personnalisée d’achat ou de vente, ne gérons aucun portefeuille et ne recevons aucun fonds à investir.',
      ],
      [
        'Garantissez-vous des résultats ?',
        'Non, et personne ne le peut honnêtement. Les marchés financiers présentent un risque de perte en capital, et les performances passées ne préjugent pas des performances futures. Ce que nous garantissons, c’est un cadre, une méthode et un suivi.',
      ],
    ],
  },
];

/**
 * Les mêmes questions, au format que les moteurs savent lire.
 *
 * Elles sont dérivées de `RUBRIQUES`, jamais recopiées : une réponse corrigée
 * dans la page l'est du même coup ici. Deux listes à maintenir en parallèle
 * divergeraient, et une donnée structurée qui contredit la page visible est
 * pire que pas de donnée structurée du tout.
 */
const DONNEES_FAQ = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: RUBRIQUES.flatMap((rubrique) =>
    rubrique.questions.map(([question, reponse]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: reponse },
    })),
  ),
};

export default function Page() {
  return (
    <>
      <DonneesStructurees donnees={DONNEES_FAQ} />

      <section className="border-b border-filet bg-surface">
        <Conteneur largeur="moyenne" className="space-y-5 py-16 sm:py-24">
          <Surtitre>Questions fréquentes</Surtitre>
          <h1 className="text-4xl font-extrabold sm:text-5xl">Ce qu’on nous demande le plus</h1>
          <p className="text-lg leading-relaxed text-encre-doux">
            Si votre question n’y est pas, elle trouvera sa réponse pendant l’échange d’orientation.
          </p>
        </Conteneur>
      </section>

      <Section>
        <div className="mx-auto max-w-3xl space-y-14">
          {RUBRIQUES.map((rubrique) => (
            <div key={rubrique.titre} className="space-y-6">
              <h2 className="text-2xl font-bold">{rubrique.titre}</h2>

              <div className="divide-y divide-filet border-y border-filet">
                {rubrique.questions.map(([question, reponse]) => (
                  // <details> plutôt qu'un accordéon en JavaScript : ça
                  // fonctionne sans script, c'est navigable au clavier, et le
                  // contenu reste trouvable par la recherche du navigateur.
                  <details key={question} className="group py-5">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold marker:content-none">
                      {question}
                      <span
                        aria-hidden
                        className="text-encre-faible transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-3 leading-relaxed text-encre-doux">{reponse}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section fond="surface">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h2 className="text-3xl font-extrabold">Une question qui n’est pas là ?</h2>
          <p className="text-lg text-encre-doux">
            Posez-la pendant l’échange d’orientation. Trente minutes, offertes, sans engagement.
          </p>
          <div className="flex justify-center">
            <Bouton href="/qualification">Faire le point sur ma situation</Bouton>
          </div>
          <AvertissementRisque className="pt-4" />
        </div>
      </Section>
    </>
  );
}
