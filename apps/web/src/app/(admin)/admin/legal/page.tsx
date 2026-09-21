import Link from 'next/link';

import { EnTete, Pastille } from '@/components/admin';
import { Carte } from '@/components/ui';

import { SOUS_TRAITANTS, TRAITEMENTS } from './inventaire';

/**
 * `/admin/legal` — l'état des pages légales, et de quoi armer le rendez-vous
 * juridique.
 *
 * **Depuis le 21 septembre 2026, cinq pages sur six sont rédigées**, à partir
 * des textes de l'ancien site (apexcompany.com, mai 2026) remis au
 * fonctionnement réel de celui-ci. Ils engagent la société, et **aucun juriste
 * ne les a relus** : ce qui suit liste, page par page, ce qui a été changé par
 * rapport à l'ancien texte et ce qu'un juriste doit trancher.
 *
 * Même principe que `/admin/contenu` : montrer ce qui manque, sans le combler
 * par de l'invention.
 */
const PAGES: Array<{ href: string; titre: string; questions: string[] }> = [
  {
    href: '/mentions-legales',
    titre: 'Mentions légales',
    questions: [
      'Rédigée. Vendeur : APEX COMPANY L.L.C-FZ, Meydan Free Zone — tranché par les textes de l’ancien site.',
      'L’objet du site y est désormais la formation au trading ; l’ancien texte parlait de « psychologie personnelle et stabilité intérieure ».',
      'Hébergeur : Vercel, recommandé mais pas encore souscrit. À changer dans lib/legal/societe.ts si le client en choisit un autre.',
      'La licence expire le 19 février 2027 : à renouveler, puis à mettre à jour ici.',
    ],
  },
  {
    href: '/cgv',
    titre: 'Conditions générales de vente',
    questions: [
      'Rédigée, et acceptée par deux cases à cocher avant chaque paiement — preuve enregistrée dans consents.',
      'Rétractation : éteinte à l’accès pour une formation, au prorata pour un accompagnement ou un abonnement. L’ancien texte l’éteignait partout dès l’activation. À valider.',
      'Médiateur de la consommation : aucun désigné. Le texte promet ses coordonnées sur demande — il faut en choisir un.',
      'Régime de TVA dans l’Union : les prix sont affichés TTC, mais le régime reste à trancher avec un comptable.',
      'Plafond de responsabilité au montant payé retiré (présumé abusif face à un consommateur). À confirmer.',
      'Outils logiciels, agents automatisés et certification interne retirés : ils ne sont pas vendus sur ce site.',
    ],
  },
  {
    href: '/avertissement',
    titre: 'Avertissement sur les risques',
    questions: [
      'Rédigée. Fusion du « disclaimer » et de l’annexe « Risk Disclosure » de l’ancien site ; /disclaimer y redirige.',
      'Accueil : « organisme de formation » est une appellation encadrée en France (déclaration d’activité). À vérifier.',
    ],
  },
  {
    href: '/remboursement',
    titre: 'Rétractation et remboursement',
    questions: [
      'Rédigée, avec le formulaire type de rétractation, absent de l’ancien site.',
      'Une rétractation au prorata est un remboursement partiel : il ne ferme ni l’accès ni l’abonnement Stripe. À faire à la main.',
    ],
  },
  {
    href: '/confidentialite',
    titre: 'Politique de confidentialité',
    questions: [
      'Rédigée. Les sous-traitants de l’ancien site (Whop, TAP, Circle, Zoom, Brevo, Google, Netlify) sont remplacés par ceux de celui-ci.',
      'Représentant dans l’Union (article 27 du RGPD) : exigé d’un responsable établi hors de l’Union qui cible des résidents européens. Aucun n’est désigné.',
      'Conservation des clients : « trois ans après le dernier achat » est écrit, mais aucune tâche ne l’applique — la purge ne touche que les prospects.',
      'Pièces comptables dix ans : repris de l’ancien texte. Le droit émirien en demande cinq ; dix couvre les deux.',
    ],
  },
  {
    href: '/cookies',
    titre: 'Politique de cookies',
    questions: [
      'Rédigée. Aucun traceur : seuls les cookies de session.',
      'À rouvrir le jour où une mesure d’audience ou un pixel publicitaire arrive : le bandeau de consentement devient alors obligatoire.',
    ],
  },
  {
    href: '/accessibilite',
    titre: 'Déclaration d’accessibilité',
    questions: [
      'Seule page encore non rédigée : un audit, puis le taux de conformité qu’il donne. Aucun n’a été fait.',
    ],
  },
];

export default function Page() {
  return (
    <>
      <EnTete
        titre="Pages légales"
        description="Ce qui a été rédigé, ce qu’un juriste doit trancher, et l’état réel des traitements de données."
      />

      <div className="rounded-carte border border-alerte bg-alerte/5 p-5">
        <p className="font-semibold text-alerte">
          Cinq pages rédigées, aucune relue par un juriste.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-encre-doux">
          Elles reprennent les textes de l’ancien site, corrigés là où ils décrivaient un autre
          fonctionnement que celui-ci. Elles engagent la société dès la mise en ligne : les points
          ci-dessous sont à faire trancher <strong>avant la première vente</strong>.
        </p>
      </div>

      {/* ── Ce qu'il faut obtenir, page par page ────────────────────────── */}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Page par page : ce qui a changé, ce qui reste</h2>
          <p className="text-sm text-encre-doux">
            Le vendeur est connu : <strong>APEX COMPANY L.L.C-FZ</strong>. Reste ce qui demande un
            juriste ou un comptable.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {PAGES.map((p) => (
            <Carte key={p.href} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{p.titre}</h3>
                <Link href={p.href} className="text-xs text-accent hover:underline">
                  voir la page →
                </Link>
              </div>
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-encre-doux">
                {p.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </Carte>
          ))}
        </div>
      </section>

      {/* ── L'inventaire ────────────────────────────────────────────────── */}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Inventaire des traitements</h2>
          <p className="text-sm leading-relaxed text-encre-doux">
            Relevé dans le schéma et dans le code, pas dans un souvenir. Ce n’est{' '}
            <strong>pas</strong> un registre : un registre nomme un responsable, une base légale et
            une durée. C’est la matière qui permet de l’écrire — et ce qu’un juriste demande en
            premier. À relire à chaque migration qui touche une de ces tables.
          </p>
        </div>

        <div className="space-y-3">
          {TRAITEMENTS.map((t) => (
            <Carte key={t.table} className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-mono text-sm font-semibold">{t.table}</h3>
                {t.aTrancher && <Pastille ton="attente">à trancher</Pastille>}
              </div>
              <p className="text-sm text-encre-doux">{t.finalite}</p>

              {t.donnees.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {t.donnees.map((d) => (
                    <li
                      key={d}
                      className="rounded-douce bg-surface-forte px-2 py-0.5 text-xs text-encre-doux"
                    >
                      {d}
                    </li>
                  ))}
                </ul>
              )}

              <dl className="space-y-2 border-t border-filet pt-3 text-sm">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium">Écrit quand</dt>
                  <dd className="text-encre-doux">{t.origine}</dd>
                </div>
                {t.aTrancher && (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-alerte">Reste à trancher</dt>
                    <dd className="text-encre-doux">{t.aTrancher}</dd>
                  </div>
                )}
              </dl>
            </Carte>
          ))}
        </div>
      </section>

      {/* ── Les sous-traitants ──────────────────────────────────────────── */}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Les services chez qui les données transitent</h2>
          <p className="text-sm text-encre-doux">
            Ceux réellement branchés, pas ceux envisagés — la liste suit{' '}
            <Link href="/admin/parametres" className="text-accent hover:underline">
              les paramètres
            </Link>
            .
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {SOUS_TRAITANTS.map((s) => (
            <Carte key={s.nom} className="space-y-2">
              <h3 className="font-semibold">{s.nom}</h3>
              <p className="text-sm leading-relaxed text-encre-doux">{s.role}</p>
              <p className="border-t border-filet pt-2 text-sm leading-relaxed text-encre-doux">
                <span className="font-medium text-alerte">À vérifier</span> — {s.aVerifier}
              </p>
            </Carte>
          ))}
        </div>
      </section>
    </>
  );
}
