export type { Database, Json } from './database.types.js';

/**
 * Les rôles applicatifs, dans le même ordre que lénumération `public.app_role`.
 *
 * Écrit à la main plutôt que dérivé des types générés, parce que la hiérarchie
 * des rôles est une décision produit, pas un détail de schéma : elle doit être
 * lisible ici, et une divergence avec la migration doit se voir en relecture.
 */
// `branding` a été retiré le 25 septembre 2026 : la valeur survit dans l'énumération
// SQL, que PostgreSQL ne sait pas amputer, mais une contrainte interdit de
// l'attribuer. Il n'a donc rien à faire ici.
export const ROLES = ['client', 'formateur', 'admin', 'owner'] as const;

export type AppRole = (typeof ROLES)[number];

/** Les rôles lus en base, sans la valeur retirée que l'énumération SQL garde encore. */
export function rolesConnus(valeurs: readonly string[]): AppRole[] {
  return valeurs.filter((v): v is AppRole => (ROLES as readonly string[]).includes(v));
}

/** Les rôles qui donnent accès au back-office dans son ensemble. */
export const ROLES_STAFF = ['admin', 'owner'] as const satisfies readonly AppRole[];

export function estStaff(roles: readonly AppRole[]): boolean {
  return roles.some((r) => (ROLES_STAFF as readonly AppRole[]).includes(r));
}

/**
 * Un montant est toujours transporté en centimes, en entier. La conversion en
 * chaîne affichable est le seul endroit où il devient décimal.
 */
export function formaterMontant(cents: number, devise = 'EUR', locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: devise }).format(cents / 100);
}
