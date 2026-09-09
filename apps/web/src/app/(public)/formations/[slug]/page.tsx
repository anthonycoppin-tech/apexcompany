import { notFound } from 'next/navigation';

import { formaterMontant } from '@apex/db';

import { DonneesStructurees } from '@/components/donnees-structurees';
import { AvertissementRisque, Bouton, Carte, Conteneur, Section, Surtitre } from '@/components/ui';
import { urlSite } from '@/lib/site';
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

  const description = data.description ?? undefined;

  return {
    title: data.titre,
    description,
    // La fiche est atteignable par son seul slug : la canonique évite qu'un
    // paramètre de campagne collé à l'adresse en fasse une deuxième page aux
    // yeux d'un moteur.
    alternates: { canonical: `/formations/${slug}` },
    openGraph: {
      type: 'website',
      title: data.titre,
      description,
      url: `/formations/${slug}`,
    },
  };
}

/**
 * Le prix au format décimal attendu par schema.org, construit depuis l'entier.
 *
 * Le reste est retiré avant la division, qui porte donc sur un multiple exact
 * de 100 : le résultat n'a pas de partie fractionnaire à arrondir. Les centimes
 * sont recollés en chaîne. Rien n'est reconstruit à partir d'un flottant, comme
 * partout ailleurs où cette base manipule de l'argent.
 */
function prixDecimal(cents: number): string {
  const centimes = cents % 100;
  const euros = (cents - centimes) / 100;

  return `${euros}.${String(centimes).padStart(2, '0')}`;
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

  /**
   * Données structurées de la fiche.
   *
   * Volontairement dépourvues de note moyenne et d'avis : nous n'en avons
   * aucun, et un moteur qui découvre un `aggregateRating` inventé sanctionne
   * tout le domaine. Elles reviendront le jour où les témoignages existent.
   */
  const donneesStructurees = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: formation.titre,
    url: `${urlSite}/formations/${formation.slug}`,
    inLanguage: 'fr',
    provider: { '@type': 'EducationalOrganization', name: 'ApexCompany', url: urlSite },
    ...(formation.description ? { description: formation.description } : {}),
    ...(formation.objectifs_pedagogiques ? { teaches: formation.objectifs_pedagogiques } : {}),
    ...(formation.prerequis ? { coursePrerequisites: formation.prerequis } : {}),
    offers: {
      '@type': 'Offer',
      price: prixDecimal(formation.prix_cents),
      priceCurrency: formation.devise.toUpperCase(),
      availability: 'https://schema.org/InStock',
      url: `${urlSite}/formations/${formation.slug}`,
      category: type?.nom ?? formation.type_produit,
    },
  };

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
      <DonneesStructurees donnees={donneesStructurees} />

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

            {/* L'abonnement se souscrit directement, tranché le 8 septembre 2026 :
                imposer un rendez-vous de vente pour un abonnement mensuel
                coûterait la majorité des inscriptions. Les accompagnements et
                les formations continuent de passer par l'échange d'orientation,
                où le panier justifie qu'on vérifie que le produit correspond. */}
            {formation.type_produit === 'abonnement' ? (
              <div className="space-y-3 border-t border-filet pt-5">
                <Bouton href={`/formations/${formation.slug}/souscrire`} className="w-full">
                  Souscrire maintenant
                </Bouton>
                <p className="text-center text-xs text-encre-doux">
                  Sans rendez-vous. Résiliable à tout moment depuis ton espace.
                </p>
              </div>
            ) : (
              <div className="space-y-3 border-t border-filet pt-5">
                <Bouton href="/qualification" className="w-full">
                  Faire le point sur ma situation
                </Bouton>
                <p className="text-center text-xs text-encre-doux">
                  On vérifie ensemble que ce programme correspond avant toute inscription.
                </p>
              </div>
            )}
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
