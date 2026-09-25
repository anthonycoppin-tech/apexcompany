import { JOUR_MS } from '../formateur/suivi.ts';
import { bornesDesJours, jourParis } from '../format.ts';

export const PERIODES = [
  { valeur: 'jour', libelle: 'Aujourd’hui', jours: 0 },
  { valeur: '7', libelle: '7 jours', jours: 7 },
  { valeur: '30', libelle: '30 jours', jours: 30 },
  { valeur: '90', libelle: '90 jours', jours: 90 },
  { valeur: '365', libelle: '12 mois', jours: 365 },
  { valeur: 'tout', libelle: 'Depuis le début', jours: null },
] as const;

export type Periode = {
  /** La valeur du paramètre `periode`, ou `jour` pour une date choisie. */
  readonly valeur: string;
  /** La date choisie, en `AAAA-MM-JJ`, quand la période est une journée. */
  readonly jour: string | null;
  readonly libelle: string;
  /** Les paramètres d'URL qui redonnent cette période, pour les liens qui la conservent. */
  readonly parametres: Readonly<Record<string, string>>;
  readonly debutMs: number;
  readonly finMs: number;
  readonly dans: (d: string | null | undefined) => boolean;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * La période d'un écran de statistiques, lue dans l'URL.
 *
 * **Une journée est un jour de Paris**, de minuit à minuit — demandé par le
 * client le 25 septembre 2026 pour lire les chiffres d'un événement (un
 * challenge, un live) sur sa seule journée. « Les dernières 24 heures »
 * mélangerait la veille au soir et le jour même, ce qui est exactement ce qu'on
 * veut ne pas voir. `?jour=AAAA-MM-JJ` choisit une date passée ;
 * `?periode=jour` vaut aujourd'hui.
 *
 * Une date illisible retombe sur la période par défaut plutôt que sur une
 * erreur : c'est une URL qu'on tape ou qu'on garde en favori.
 */
export function lirePeriode(
  parametres: { periode?: string; jour?: string },
  parDefaut = '30',
  maintenant = Date.now(),
): Periode {
  const jourDemande =
    parametres.jour && DATE.test(parametres.jour) && !Number.isNaN(Date.parse(parametres.jour))
      ? parametres.jour
      : parametres.periode === 'jour'
        ? jourParis(new Date(maintenant))
        : null;

  if (jourDemande) {
    const { debut, fin } = bornesDesJours(jourDemande, jourDemande);
    const debutMs = new Date(debut).getTime();
    const finMs = new Date(fin).getTime();
    const aujourdhui = jourDemande === jourParis(new Date(maintenant));
    return {
      valeur: 'jour',
      jour: jourDemande,
      libelle: aujourdhui
        ? 'Aujourd’hui'
        : new Date(`${jourDemande}T12:00:00Z`).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
      parametres: aujourdhui ? { periode: 'jour' } : { jour: jourDemande },
      debutMs,
      finMs,
      dans: (d) => !!d && new Date(d).getTime() >= debutMs && new Date(d).getTime() < finMs,
    };
  }

  const choisie =
    PERIODES.find((p) => p.valeur === parametres.periode && p.valeur !== 'jour') ??
    PERIODES.find((p) => p.valeur === parDefaut)!;
  const debutMs = choisie.jours === null ? 0 : maintenant - choisie.jours * JOUR_MS;
  return {
    valeur: choisie.valeur,
    jour: null,
    libelle: choisie.libelle,
    parametres: { periode: choisie.valeur },
    debutMs,
    finMs: maintenant,
    dans: (d) => !!d && new Date(d).getTime() >= debutMs && new Date(d).getTime() <= maintenant,
  };
}
