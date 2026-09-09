import Link from 'next/link';

import { formaterMontant } from '@apex/db';

import { DonneesStructurees } from '@/components/donnees-structurees';
import { AvertissementRisque, Bouton, Carte, Conteneur, Section, Surtitre } from '@/components/ui';
import { urlSite } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export const metadata = { alternates: { canonical: '/' } };

/**
 * L'organisme, décrit une seule fois pour toutes les pages — c'est l'accueil
 * qui le porte, comme le veut l'usage.
 *
 * Ni adresse, ni raison sociale, ni logo : **laquelle des deux sociétés vend
 * n'est pas tranché** (`docs/08-CE-QUI-MANQUE.md`), et une entité juridique
 * annoncée à tort ici serait reprise telle quelle par les moteurs. Seul le nom
 * de marque, employé partout sur le site, est affirmé. Le reste s'ajoute avec
 * les mentions légales, d'un seul tenant.
 */
const DONNEES_ORGANISME = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  name: 'ApexCompany',
  url: urlSite,
  description:
    'Organisme de formation au trading : psychologie de l’exécution, rigueur méthodique et ' +
    'progression par niveau.',
};

/**
 * La page d'accueil — le point d'entrée unique des réseaux sociaux.
 *
 * Le vocabulaire reprend celui que le client emploie déjà : rigueur cognitive
 * et technique, approche neuro-éducative, trois piliers. Ce n'est pas de la
 * paresse — c'est son positionnement, il est bon, et il évite soigneusement
 * toute promesse de rendement. Cette prudence est reprise telle quelle.
 *
 * Ce qui change par rapport au site actuel : **un seul chemin**. Tous les
 * appels à l'action mènent à `/qualification`. Pas de bouton « acheter » sur
 * l'accueil, pas de formulaire de contact concurrent.
 */

const PILIERS = [
  {
    titre: 'Psychologie',
    texte:
      'Travail sur les biais, la discipline et la qualité de l’exécution sous pression. C’est là que se perdent la plupart des plans, bien avant la technique.',
  },
  {
    titre: 'Rigueur',
    texte:
      'Structuration méthodique de l’analyse et de la gestion du risque. Transformer l’intuition en processus décisionnel, et le processus en habitude.',
  },
  {
    titre: 'Progression',
    texte:
      'Des programmes organisés par niveau et adaptés à votre objectif. On ne commence pas au même endroit selon qu’on découvre ou qu’on pratique depuis deux ans.',
  },
];

const ETAPES = [
  {
    titre: 'Vous faites le point',
    texte:
      'Deux minutes de questions sur votre situation, votre niveau et ce qui vous bloque aujourd’hui.',
  },
  {
    titre: 'Vous réservez votre échange',
    texte:
      'Trente minutes avec Franck, offertes et sans engagement. Un point sur votre situation, pas une présentation de produit.',
  },
  {
    titre: 'Vous recevez une proposition',
    texte:
      'Le programme retenu à l’issue de l’échange, avec son prix et sa durée. Vous décidez ensuite, depuis votre espace.',
  },
  {
    titre: 'Votre accès s’ouvre',
    texte:
      'Accès immédiat au serveur Discord du programme : les sessions en direct, les échanges et les replays s’y trouvent.',
  },
];

/**
 * Les chiffres de réassurance.
 *
 * Repris du site actuel, et **aucun n'est sourcé ni daté**. Sur un site de
 * formation à l'investissement, « 100 % de membres qui recommandent » n'est pas
 * une décoration : c'est une allégation commerciale, opposable, et invérifiable
 * en l'état. Elle vieillit aussi sans prévenir — « 80+ apprenants » devient faux
 * par le haut, ce qui est tout aussi gênant que l'inverse.
 *
 * D'où la règle portée par le type plutôt que par la vigilance : **un chiffre
 * ne s'affiche que s'il porte une source et une date de vérification.** Aucun
 * des quatre n'en a, la section ne s'affiche donc pas — au lieu de compter sur
 * quelqu'un pour y penser avant la mise en ligne, comme le demandait le
 * commentaire qui tenait ici.
 *
 * Les valeurs restent écrites : renseigner `source` et `verifieLe` suffit à les
 * republier, une fois le client interrogé (`docs/08-CE-QUI-MANQUE.md`, §3).
 */
type Chiffre = {
  valeur: string;
  libelle: string;
  source: string | null;
  verifieLe: string | null;
};

const CHIFFRES: Chiffre[] = [
  { valeur: '80+', libelle: 'apprenants accompagnés', source: null, verifieLe: null },
  { valeur: '9/10', libelle: 'satisfaction déclarée', source: null, verifieLe: null },
  { valeur: '100 %', libelle: 'de membres qui recommandent', source: null, verifieLe: null },
  { valeur: '24 h', libelle: 'de délai de réponse', source: null, verifieLe: null },
];

const chiffresPublies = CHIFFRES.filter((c) => c.source && c.verifieLe);

const TYPES: Record<string, string> = {
  abonnement: 'Abonnement mensuel',
  accompagnement: 'Accompagnement',
  formation: 'Formation',
};

export default async function Page() {
  const supabase = await createClient();

  // La politique `formations_publiques_en_lecture` ne laisse passer que les
  // produits actifs : le brouillon reste invisible sans filtre à écrire ici.
  const { data: formations } = await supabase
    .from('formations')
    .select('id, slug, titre, description, prix_cents, devise, type_produit, modalite')
    .order('ordre')
    .limit(3);

  return (
    <>
      <DonneesStructurees donnees={DONNEES_ORGANISME} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-filet bg-fond">
        <Conteneur className="grid gap-12 py-20 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-7">
            <Surtitre>Approche neuro-éducative</Surtitre>

            <h1 className="text-4xl leading-[1.08] font-extrabold sm:text-5xl lg:text-6xl">
              Maîtrisez la rigueur <span className="text-accent">cognitive</span> et technique
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-encre-doux">
              Un cursus construit autour de l’analyse, de la psychologie de l’exécution et de la
              gestion du risque. Encadré, progressif, et suivi individuellement.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Bouton href="/qualification">Faire le point sur ma situation</Bouton>
              <Bouton href="/formations" variante="secondaire">
                Voir les programmes
              </Bouton>
            </div>

            <p className="text-sm text-encre-doux">
              Échange d’orientation de 30 minutes offert · Sans engagement
            </p>
          </div>

          {/* Le parcours, montré dès l'accueil. Un tunnel qui commence par un
              questionnaire surprend s'il n'est pas annoncé : le dire ici évite
              l'abandon au premier écran. */}
          <Carte className="bg-surface">
            <p className="font-titre text-sm font-bold tracking-wide uppercase">
              Comment ça se passe
            </p>
            <ol className="mt-5 space-y-5">
              {ETAPES.map((e, i) => (
                <li key={e.titre} className="flex gap-4">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-contraste tabular-nums">
                    {i + 1}
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{e.titre}</p>
                    <p className="text-sm leading-relaxed text-encre-doux">{e.texte}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Carte>
        </Conteneur>
      </section>

      {/* ── Les trois piliers ────────────────────────────────────────────── */}
      <Section fond="surface">
        <div className="max-w-2xl space-y-4">
          <Surtitre>Notre approche</Surtitre>
          <h2 className="text-3xl font-extrabold sm:text-4xl">Trois piliers, dans cet ordre</h2>
          <p className="text-lg text-encre-doux">
            La technique s’apprend vite. Ce qui prend du temps, c’est de la tenir quand le marché ne
            va pas dans votre sens.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PILIERS.map((p, i) => (
            <Carte key={p.titre} className="space-y-3">
              <span className="font-titre text-sm font-bold text-accent tabular-nums">
                0{i + 1}
              </span>
              <h3 className="text-xl font-bold">{p.titre}</h3>
              <p className="leading-relaxed text-encre-doux">{p.texte}</p>
            </Carte>
          ))}
        </div>
      </Section>

      {/* ── Les programmes ───────────────────────────────────────────────── */}
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl space-y-4">
            <Surtitre>Les programmes</Surtitre>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Un format par situation</h2>
            <p className="text-lg text-encre-doux">
              Le programme adapté se décide pendant l’échange d’orientation, pas avant. Voici ce qui
              existe.
            </p>
          </div>
          <Link href="/formations" className="text-sm font-semibold text-accent hover:underline">
            Tout voir →
          </Link>
        </div>

        {formations?.length ? (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {formations.map((f) => (
              <Carte key={f.id} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-encre-faible uppercase">
                    {TYPES[f.type_produit] ?? f.type_produit} ·{' '}
                    {f.modalite === 'individuel' ? 'Individuel' : 'En groupe'}
                  </p>
                  <h3 className="text-xl font-bold">{f.titre}</h3>
                </div>
                {f.description && (
                  <p className="flex-1 leading-relaxed text-encre-doux">{f.description}</p>
                )}
                <p className="font-titre text-2xl font-extrabold tabular-nums">
                  {formaterMontant(f.prix_cents, f.devise)}
                  {f.type_produit === 'abonnement' && (
                    <span className="text-sm font-medium text-encre-doux"> / mois</span>
                  )}
                </p>
                <Link
                  href={`/formations/${f.slug}`}
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  En savoir plus →
                </Link>
              </Carte>
            ))}
          </div>
        ) : (
          <p className="mt-10 text-encre-doux">Le catalogue arrive.</p>
        )}
      </Section>

      {/* ── La communauté ────────────────────────────────────────────────── */}
      <Section fond="nuit">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-5">
            <p className="text-xs font-semibold tracking-[0.14em] text-white/60 uppercase">
              La communauté
            </p>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Tout se passe au même endroit</h2>
            <p className="text-lg leading-relaxed text-white/70">
              Les sessions en direct, les échanges avec les formateurs et les replays vivent sur un
              serveur Discord privé. Votre accès s’ouvre automatiquement dès votre inscription, et
              se ferme à la fin de votre programme.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              [
                'Sessions en direct',
                'Dans le salon vocal de votre programme, sans lien à retrouver.',
              ],
              ['Replays', 'Disponibles au même endroit, pas sur une plateforme de plus.'],
              [
                'Accès automatique',
                'Attribué au paiement, retiré en fin d’accès. Rien à demander.',
              ],
              ['Un salon par programme', 'Vous ne voyez que ce qui vous concerne.'],
            ].map(([titre, texte]) => (
              <li key={titre} className="rounded-carte bg-nuit-douce p-5">
                <p className="font-semibold">{titre}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{texte}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── Chiffres ─────────────────────────────────────────────────────── */}
      {chiffresPublies.length > 0 && (
        <Section fond="surface">
          <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {chiffresPublies.map((c) => (
              <div key={c.libelle} className="space-y-1">
                <dt className="font-titre text-4xl font-extrabold text-accent tabular-nums">
                  {c.valeur}
                </dt>
                <dd className="text-sm text-encre-doux">{c.libelle}</dd>
                {/* La source affichée n'est pas une précaution juridique de
                    plus : c'est ce qui rend le chiffre croyable. Un nombre nu
                    se lit comme une affirmation, un nombre daté comme une
                    mesure. */}
                <p className="text-xs text-encre-faible">
                  {c.source} · vérifié en {c.verifieLe}
                </p>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {/* ── Appel final ──────────────────────────────────────────────────── */}
      <Section>
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Commencez par un point sur votre situation
          </h2>
          <p className="text-lg text-encre-doux">
            Deux minutes de questions, puis un échange de trente minutes avec Franck. Vous saurez
            quoi faire ensuite, que ce soit avec nous ou non.
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
