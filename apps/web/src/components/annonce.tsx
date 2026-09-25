import Link from 'next/link';

import { jourParis } from '@/lib/format';

export type AnnonceAffichee = {
  surtitre: string | null;
  titre: string;
  texte: string | null;
  date_evenement: string | null;
  lien_url: string | null;
  lien_libelle: string | null;
};

/** « Dans 20 jours », « Demain », « Aujourd'hui » — compté en jours de Paris. */
function compteARebours(dateEvenement: string, maintenant = new Date()): string | null {
  const jours = Math.round(
    (Date.parse(`${dateEvenement}T00:00:00Z`) - Date.parse(`${jourParis(maintenant)}T00:00:00Z`)) /
      86_400_000,
  );
  if (jours < 0) return null;
  if (jours === 0) return 'Aujourd’hui';
  if (jours === 1) return 'Demain';
  return `Dans ${jours} jours`;
}

/**
 * Le bandeau d'événement du premier bloc de l'accueil (25 septembre 2026).
 *
 * Posé sur le dégradé de la marque — c'est l'une des « grandes surfaces » où
 * la charte le réserve —, avec le texte en `encre` pleine : `encre-doux` y
 * tombe sous le seuil de lisibilité sur le bout violet. Le bouton est en
 * `bg-encre text-fond` plutôt qu'en accent, dont le violet clair se perdrait
 * sur ce fond.
 *
 * Il n'affiche que ce que la base lui donne : une annonce échue n'arrive
 * jamais jusqu'ici, la politique RLS et la requête de la page la filtrent.
 */
export function BandeauAnnonce({ annonce }: { annonce: AnnonceAffichee }) {
  const date = annonce.date_evenement
    ? new Date(`${annonce.date_evenement}T12:00:00Z`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'Europe/Paris',
      })
    : null;
  const rebours = annonce.date_evenement ? compteARebours(annonce.date_evenement) : null;
  const externe = annonce.lien_url?.startsWith('https://') ?? false;

  return (
    <aside
      aria-label="Événement à venir"
      className="fond-degrade flex flex-col gap-5 rounded-carte p-6 text-encre sm:flex-row sm:items-center sm:justify-between sm:p-8"
    >
      <div className="space-y-2">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold tracking-[0.14em] uppercase">
          <span>{annonce.surtitre ?? 'Événement'}</span>
          {date && <span className="first-letter:uppercase">· {date}</span>}
          {rebours && (
            <span className="rounded-full bg-encre px-2.5 py-0.5 tracking-normal text-fond normal-case">
              {rebours}
            </span>
          )}
        </p>
        <p className="titre-banniere text-2xl leading-tight sm:text-3xl">{annonce.titre}</p>
        {annonce.texte && <p className="max-w-2xl leading-relaxed">{annonce.texte}</p>}
      </div>

      {annonce.lien_url && annonce.lien_libelle && (
        <Link
          href={annonce.lien_url}
          {...(externe ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="inline-flex flex-none items-center justify-center rounded-douce bg-encre px-5 py-3 text-sm font-semibold text-fond transition-opacity hover:opacity-90"
        >
          {annonce.lien_libelle}
        </Link>
      )}
    </aside>
  );
}
