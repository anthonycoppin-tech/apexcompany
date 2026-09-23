import { AvertissementRisque, Bouton, Carte, Conteneur, Section, Surtitre } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'L’équipe',
  description:
    'Qui vous accompagne, comment le suivi est réparti, et pourquoi chaque parcours commence ' +
    'par le même échange.',
};

/**
 * `/formateurs` — l'équipe.
 *
 * Les fiches viennent de la base, saisies au back-office : elles changent plus
 * souvent que le code, et une biographie ne mérite pas un déploiement.
 *
 * Le filtre `publie` est explicite et ne double pas la RLS pour rien : les
 * politiques d'une même commande se combinent en **OU**, donc
 * `formateurs_fiches_interne_lit_tout` ferait voir les brouillons à un membre
 * du staff connecté — sur la page publique. Une page publique doit montrer la
 * même chose à tout le monde.
 *
 * **Rien n'est inventé en leur absence.** Tant qu'aucune fiche n'est publiée, la
 * page ne montre personne et se contente de ce qui est vrai et vérifiable : le
 * fonctionnement du suivi, qui reçoit les prospects, comment on se passe le
 * relais. C'est déjà l'essentiel de ce qu'elle doit répondre — « à qui vais-je
 * avoir affaire ? ». Une biographie inventée sur un site de formation en
 * investissement est un risque, pas un espace réservé.
 *
 * La page est dynamique depuis qu'elle lit la base, comme le catalogue.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: fiches } = await supabase
    .from('formateurs_fiches')
    .select('id, nom, fonction, biographie, specialites, photo_url')
    .eq('publie', true)
    .order('ordre');

  const equipe = fiches ?? [];

  // La section d'équipe s'insère au milieu de la page et décale l'alternance
  // des fonds : sans ça, deux sections de même couleur se retrouvent collées
  // selon qu'il existe ou non des fiches publiées.
  const apresEquipe = equipe.length > 0 ? 'surface' : 'page';
  const final = equipe.length > 0 ? 'page' : 'surface';

  return (
    <>
      <section className="border-b border-filet bg-surface">
        <Conteneur largeur="moyenne" className="space-y-5 py-16 sm:py-24">
          <Surtitre>L’équipe</Surtitre>
          <h1 className="text-4xl font-extrabold sm:text-5xl">Des formateurs, pas des vendeurs</h1>
          <p className="text-lg leading-relaxed text-encre-doux">
            L’échange d’orientation n’est pas confié à un commercial. Il est mené par la personne
            qui dirige l’accompagnement, parce que c’est elle qui saura vous dire si un programme
            correspond — ou s’il vaut mieux attendre.
          </p>
        </Conteneur>
      </section>

      {/* Les personnes d'abord, quand il y en a : c'est ce que la page promet.
          Sans fiche publiée, la section disparaît entièrement plutôt que
          d'afficher un cadre vide. */}
      {equipe.length > 0 && (
        <Section>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {equipe.map((f) => (
              <Carte key={f.id} className="space-y-4">
                {/* `next/image` refuse une adresse hors des domaines déclarés dans
                    next.config, et celle-ci est saisie librement au back-office. */}
                {f.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.photo_url}
                    alt=""
                    className="h-20 w-20 rounded-full border border-filet object-cover"
                  />
                )}
                <div className="space-y-1">
                  <h2 className="text-xl font-bold">{f.nom}</h2>
                  {f.fonction && <p className="text-sm text-encre-doux">{f.fonction}</p>}
                </div>
                {f.biographie && (
                  <p className="leading-relaxed whitespace-pre-line text-encre-doux">
                    {f.biographie}
                  </p>
                )}
                {f.specialites.length > 0 && (
                  <ul className="flex flex-wrap gap-2 border-t border-filet pt-4">
                    {f.specialites.map((s) => (
                      <li
                        key={s}
                        className="rounded-douce bg-accent-doux px-2.5 py-1 text-xs font-medium text-accent"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </Carte>
            ))}
          </div>
        </Section>
      )}

      <Section fond={apresEquipe}>
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

      <Section fond={final}>
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
