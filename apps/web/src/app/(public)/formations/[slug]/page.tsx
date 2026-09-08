import { notFound } from 'next/navigation';

import { formaterMontant } from '@apex/db';

import { AvertissementRisque, Bouton, Carte, Conteneur, Section, Surtitre } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';

const TYPES: Record<string, { nom: string; paiement: string }> = {
  abonnement: {
    nom: 'Abonnement mensuel',
    paiement: 'Prélèvement mensuel, résiliable à tout moment',
  },
  accompagnement: { nom: 'Accompagnement', paiement: 'Payé en une fois' },
  formation: { nom: 'Formation', paiement: 'Payée en une fois' },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('formations')
    .select('titre, description')
    .eq('slug', slug)
    .maybeSingle();

  if (!data) return { title: 'Programme introuvable' };

  return { title: data.titre, description: data.description ?? undefined };
}

/**
 * `/formations/[slug]` — la fiche produit.
 *
 * Elle sert à convaincre, pas à acheter : le seul appel à l'action mène à
 * `/qualification`. Un bouton « acheter » ici court-circuiterait l'échange
 * d'orientation, qui est précisément l'endroit où l'on vérifie que le programme
 * correspond à la situation de la personne.
 *
 * Tout ce qui s'affiche vient du catalogue en base — titre, objectifs,
 * prérequis, durée, tarif. Rien n'est écrit en dur : le back-office reste la
 * source unique, et une correction de tarif n'attend pas un déploiement.
 */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: formation } = await supabase
    .from('formations')
    .select(
      'id, slug, titre, description, objectifs_pedagogiques, prerequis, prix_cents, devise, type_produit, modalite, duree_semaines, volume_horaire, duree_acces_jours',
    )
    .eq('slug', slug)
    .maybeSingle();

  // La RLS ne laisse voir que les produits actifs : un brouillon rend 404, ce
  // qui est le bon comportement — il n'est pas encore publié.
  if (!formation) notFound();

  const type = TYPES[formation.type_produit];

  const details: Array<[string, string]> = [
    ['Format', type?.nom ?? formation.type_produit],
    ['Suivi', formation.modalite === 'individuel' ? 'Individuel' : 'En groupe'],
    [
      'Durée d’accès',
      formation.type_produit === 'accompagnement' && formation.duree_acces_jours
        ? `${formation.duree_acces_jours} jours`
        : formation.type_produit === 'abonnement'
          ? 'Tant que l’abonnement est actif'
          : 'Illimité',
    ],
    ...(formation.duree_semaines
      ? ([['Durée du cursus', `${formation.duree_semaines} semaines`]] as Array<[string, string]>)
      : []),
    ...(formation.volume_horaire
      ? ([['Volume horaire', `${formation.volume_horaire} heures`]] as Array<[string, string]>)
      : []),
    ['Paiement', type?.paiement ?? '—'],
  ];

  return (
    <>
      <section className="border-b border-filet bg-surface">
        <Conteneur className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-6">
            <Surtitre>{type?.nom ?? formation.type_produit}</Surtitre>
            <h1 className="text-4xl font-extrabold sm:text-5xl">{formation.titre}</h1>
            {formation.description && (
              <p className="max-w-2xl text-lg leading-relaxed text-encre-doux">
                {formation.description}
              </p>
            )}
          </div>

          <Carte className="space-y-6">
            <div>
              <p className="font-titre text-3xl font-extrabold tabular-nums">
                {formaterMontant(formation.prix_cents, formation.devise)}
                {formation.type_produit === 'abonnement' && (
                  <span className="text-base font-medium text-encre-doux"> / mois</span>
                )}
              </p>
            </div>

            <dl className="space-y-3 border-t border-filet pt-5 text-sm">
              {details.map(([cle, valeur]) => (
                <div key={cle} className="flex justify-between gap-4">
                  <dt className="text-encre-doux">{cle}</dt>
                  <dd className="text-right">{valeur}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-3 border-t border-filet pt-5">
              <Bouton href="/qualification" className="w-full">
                Faire le point sur ma situation
              </Bouton>
              <p className="text-center text-xs text-encre-doux">
                On vérifie ensemble que ce programme correspond avant toute inscription.
              </p>
            </div>
          </Carte>
        </Conteneur>
      </section>

      {(formation.objectifs_pedagogiques || formation.prerequis) && (
        <Section>
          <div className="grid gap-12 lg:grid-cols-2">
            {formation.objectifs_pedagogiques && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Objectifs pédagogiques</h2>
                <p className="leading-relaxed whitespace-pre-line text-encre-doux">
                  {formation.objectifs_pedagogiques}
                </p>
              </div>
            )}
            {formation.prerequis && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Prérequis</h2>
                <p className="leading-relaxed whitespace-pre-line text-encre-doux">
                  {formation.prerequis}
                </p>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section fond="surface">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h2 className="text-3xl font-extrabold">Est-ce le bon programme pour vous ?</h2>
          <p className="text-lg text-encre-doux">
            Deux minutes de questions, puis trente minutes avec Franck pour en décider ensemble.
            Offert, sans engagement.
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
