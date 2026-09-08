import { AvertissementRisque, Bouton, Carte, Conteneur, Section, Surtitre } from '@/components/ui';

export const metadata = {
  title: 'L’équipe',
  description:
    'Qui vous accompagne, comment le suivi est réparti, et pourquoi chaque parcours commence ' +
    'par le même échange.',
};

/**
 * `/formateurs` — l'équipe.
 *
 * **Cette page attend du contenu client** : biographies, photos, parcours,
 * spécialités. Rien n'a été inventé ici — une biographie inventée sur un site
 * de formation en investissement est un risque, pas un espace réservé.
 *
 * Ce qui est écrit est vrai et vérifiable : le fonctionnement du suivi, qui
 * reçoit les prospects, et comment un client passe d'un formateur à l'autre.
 * C'est déjà l'essentiel de ce que cette page doit répondre — « à qui vais-je
 * avoir affaire ? ».
 *
 * Le jour où les fiches arrivent, elles méritent leur propre table plutôt que
 * du contenu en dur : elles changent plus souvent que le code.
 */
export default function Page() {
  return (
    <>
      <section className="border-b border-filet bg-surface">
        <Conteneur className="max-w-3xl space-y-5 py-16 sm:py-24">
          <Surtitre>L’équipe</Surtitre>
          <h1 className="text-4xl font-extrabold sm:text-5xl">Des formateurs, pas des vendeurs</h1>
          <p className="text-lg leading-relaxed text-encre-doux">
            L’échange d’orientation n’est pas confié à un commercial. Il est mené par la personne
            qui dirige l’accompagnement, parce que c’est elle qui saura vous dire si un programme
            correspond — ou s’il vaut mieux attendre.
          </p>
        </Conteneur>
      </section>

      <Section>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            [
              'Un premier échange, une seule personne',
              'Tous les échanges d’orientation sont menés par Franck, qui dirige l’accompagnement. Vous ne racontez pas votre situation deux fois.',
            ],
            [
              'Un suivi réparti selon le besoin',
              'La psychologie de l’exécution et la technique ne s’enseignent pas par la même personne ni dans le même ordre. L’équipe se passe le relais selon ce que votre parcours demande.',
            ],
            [
              'Des notes, pas des souvenirs',
              'Vos objectifs, vos points de blocage et ce qui a été travaillé sont consignés. Un changement d’interlocuteur ne vous fait pas repartir de zéro.',
            ],
          ].map(([titre, texte]) => (
            <Carte key={titre} className="space-y-3">
              <h2 className="text-xl font-bold">{titre}</h2>
              <p className="leading-relaxed text-encre-doux">{texte}</p>
            </Carte>
          ))}
        </div>
      </Section>

      <Section fond="surface">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h2 className="text-3xl font-extrabold">Le plus simple est d’en parler</h2>
          <p className="text-lg text-encre-doux">
            Trente minutes avec Franck. Vous saurez quoi faire ensuite, que ce soit avec nous ou
            non.
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
