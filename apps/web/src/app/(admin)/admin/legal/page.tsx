import Link from 'next/link';

import { EnTete, Pastille } from '@/components/admin';
import { Carte } from '@/components/ui';

import { SOUS_TRAITANTS, TRAITEMENTS } from './inventaire';

/**
 * `/admin/legal` — de quoi armer le rendez-vous juridique.
 *
 * Les six pages légales sont le dernier blocage avant la mise en vente, et
 * elles n'attendent pas un développeur : elles attendent une identité de
 * société, un régime de vente et un juriste. Ce qu'on peut préparer sans eux,
 * c'est ce qui leur sera demandé de toute façon — l'état réel des traitements,
 * et la liste des questions par page.
 *
 * **Aucun texte juridique n'est rédigé ici**, ni sur les pages publiques.
 * Recopier un modèle engagerait la société sur des clauses que personne n'a
 * lues, et c'est précisément ce qu'un investisseur lésé irait chercher.
 *
 * Même principe que `/admin/contenu` : montrer ce qui manque, sans le combler
 * par de l'invention.
 */
const PAGES: Array<{ href: string; titre: string; questions: string[] }> = [
  {
    href: '/mentions-legales',
    titre: 'Mentions légales',
    questions: [
      'Raison sociale, forme juridique, capital, adresse du siège.',
      'Numéro d’immatriculation et numéro de TVA, s’il y en a un.',
      'Nom du directeur de la publication.',
      'Coordonnées de l’hébergeur — Supabase pour la base, et l’hébergeur du site, encore à choisir.',
    ],
  },
  {
    href: '/cgv',
    titre: 'Conditions générales de vente',
    questions: [
      'Laquelle des deux sociétés vend au client final ? Tout le reste en découle.',
      'Régime de TVA applicable : vendeur à Dubaï, clients dans l’Union.',
      'Droit de rétractation : quatorze jours, et à quelle condition il s’éteint pour un contenu accessible immédiatement.',
      'Ce que recouvre exactement chaque produit — la plateforme dit « accès », les CGV doivent dire à quoi.',
      'Résiliation de l’abonnement : le code résilie à effet différé, sans délai de grâce. À confirmer.',
    ],
  },
  {
    href: '/confidentialite',
    titre: 'Politique de confidentialité',
    questions: [
      'Qui est le responsable de traitement, et faut-il un DPO.',
      'Durée de conservation par finalité — voir l’inventaire ci-dessous.',
      'Base légale de chaque traitement : le consentement est recueilli au formulaire, mais il ne couvre pas la comptabilité.',
      'Adresse dédiée aux demandes d’exercice des droits.',
      'Transferts hors Union : à confirmer en regardant la région réelle de chaque service.',
    ],
  },
  {
    href: '/cookies',
    titre: 'Politique de cookies',
    questions: [
      'Rien à obtenir tant qu’aucun traceur n’est posé — c’est le cas aujourd’hui.',
      'À rouvrir le jour où une mesure d’audience ou un pixel publicitaire arrive : le bandeau de consentement devient alors obligatoire.',
    ],
  },
  {
    href: '/remboursement',
    titre: 'Politique de remboursement',
    questions: [
      'Dans quels cas un remboursement est accordé, et sous quel délai.',
      'Remboursement partiel au prorata d’un accès entamé, ou tout ou rien.',
      'Qui décide, et qui exécute. Le back-office sépare déjà la demande de l’exécution.',
    ],
  },
  {
    href: '/accessibilite',
    titre: 'Déclaration d’accessibilité',
    questions: [
      'Un audit, puis le taux de conformité qu’il donne. Aucun n’a été fait.',
      'Le seuil réglementaire dépend du chiffre d’affaires et du statut de la société — donc, là encore, de qui vend.',
    ],
  },
];

export default function Page() {
  return (
    <>
      <EnTete
        titre="Pages légales"
        description="Ce qu’il faut obtenir pour les écrire, et l’état réel des traitements de données."
      />

      <div className="rounded-carte border border-alerte bg-alerte/5 p-5">
        <p className="font-semibold text-alerte">Les six pages sont publiques et vides.</p>
        <p className="mt-1 text-sm leading-relaxed text-encre-doux">
          Elles annoncent qu’elles ne sont pas encore publiées et renvoient vers le contact, ce qui
          vaut mieux que l’ancien « Placeholder — écran à construire ». Elles sont retirées de
          l’indexation tant qu’elles sont dans cet état. <strong>Rien n’y est rédigé</strong> :
          recopier un modèle engagerait la société sur des clauses que personne n’a lues.
        </p>
      </div>

      {/* ── Ce qu'il faut obtenir, page par page ────────────────────────── */}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Ce qu’il faut obtenir, page par page</h2>
          <p className="text-sm text-encre-doux">
            Une seule réponse débloque la moitié de cette liste : <strong>qui vend</strong>.
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
