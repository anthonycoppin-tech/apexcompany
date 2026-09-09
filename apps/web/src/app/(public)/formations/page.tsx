import Link from 'next/link';

import { formaterMontant } from '@apex/db';

import { AvertissementRisque, Bouton, Carte, Conteneur, Section, Surtitre } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Les programmes',
  description:
    'Abonnement communauté, accompagnement sur une période, formation à accès illimité : ' +
    'trois formats, un seul point d’entrée.',
};

const TYPES: Record<string, { nom: string; acces: string }> = {
  abonnement: { nom: 'Abonnement mensuel', acces: 'Accès tant que l’abonnement est actif' },
  accompagnement: { nom: 'Accompagnement', acces: 'Accès sur une durée définie' },
  formation: { nom: 'Formation', acces: 'Accès illimité, sans date de fin' },
};

/**
 * `/formations` — le catalogue.
 *
 * **Aucun bouton d'achat.** Les fiches servent à convaincre ; le programme
 * adapté se décide pendant l'échange d'orientation, et c'est la proposition
 * émise à l'issue de cet échange qui ouvre le paiement. C'est le principe du
 * tunnel unique.
 *
 * Une exception reste ouverte et n'est pas tranchée : la vente en self-service
 * de l'abonnement communauté (01-CAHIER-DES-CHARGES.md §8.2). Tant qu'elle ne
 * l'est pas, tout passe par le même chemin.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: formations } = await supabase
    .from('formations')
    .select(
      'id, slug, titre, description, prix_cents, devise, type_produit, modalite, duree_semaines, duree_acces_jours',
    )
    .order('ordre');

  return (
    <>
      <section className="border-b border-filet bg-surface">
        <Conteneur largeur="moyenne" className="space-y-5 py-16 sm:py-24">
          <Surtitre>Les programmes</Surtitre>
          <h1 className="text-4xl font-extrabold sm:text-5xl">Trois formats, une même méthode</h1>
          <p className="text-lg leading-relaxed text-encre-doux">
            Ils ne diffèrent pas par le contenu mais par l’intensité du suivi et la durée de
            l’accès. Lequel vous convient se décide pendant l’échange d’orientation — c’est
            précisément ce à quoi il sert.
          </p>
        </Conteneur>
      </section>

      <Section>
        {formations?.length ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {formations.map((f) => {
              const type = TYPES[f.type_produit];

              return (
                <Carte key={f.id} className="flex flex-col gap-5">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-wide text-encre-faible uppercase">
                      {type?.nom ?? f.type_produit} ·{' '}
                      {f.modalite === 'individuel' ? 'Individuel' : 'En groupe'}
                    </p>
                    <h2 className="text-2xl font-bold">{f.titre}</h2>
                  </div>

                  {f.description && (
                    <p className="flex-1 leading-relaxed text-encre-doux">{f.description}</p>
                  )}

                  <dl className="space-y-2 border-t border-filet pt-5 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-encre-doux">Accès</dt>
                      <dd className="text-right">
                        {/* Une durée nulle veut dire illimité, jamais « non renseigné ». */}
                        {f.type_produit === 'accompagnement' && f.duree_acces_jours
                          ? `${f.duree_acces_jours} jours`
                          : (type?.acces ?? '—')}
                      </dd>
                    </div>
                    {f.duree_semaines && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-encre-doux">Durée du cursus</dt>
                        <dd>{f.duree_semaines} semaines</dd>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-encre-doux">Tarif</dt>
                      <dd className="font-titre text-xl font-extrabold tabular-nums">
                        {formaterMontant(f.prix_cents, f.devise)}
                        {f.type_produit === 'abonnement' && (
                          <span className="text-sm font-medium text-encre-doux"> / mois</span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    href={`/formations/${f.slug}`}
                    className="text-sm font-semibold text-accent hover:underline"
                  >
                    Voir le détail →
                  </Link>
                </Carte>
              );
            })}
          </div>
        ) : (
          <p className="text-encre-doux">Le catalogue arrive.</p>
        )}
      </Section>

      <Section fond="surface">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h2 className="text-3xl font-extrabold">Vous hésitez entre deux formats ?</h2>
          <p className="text-lg text-encre-doux">
            C’est normal, et c’est justement ce que l’échange d’orientation sert à trancher. Trente
            minutes, offertes, sans engagement.
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
