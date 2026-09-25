import { type AppRole } from '@apex/db';

/**
 * Les deux profils de formateur, demandés par le client le 25 septembre 2026.
 *
 * - **Formateur admin** : le rôle `formateur` **et** un rôle du staff (`admin`
 *   ou `owner`). Il a accès à tout — c'est le cas de Franck, qui dirige
 *   l'accompagnement commercial. Aucun rôle nouveau : ce que « tout » veut dire
 *   est déjà écrit dans les politiques RLS du staff, et le reproduire dans un
 *   rôle à part ferait deux définitions de « tout » qui divergeraient.
 * - **Formateur employé** : le rôle `formateur` seul. Ses affectations, et rien
 *   de ce qui dit comment l'entreprise se porte — ni argent, ni statistiques.
 *
 * Sans dépendance serveur : lu aussi par le header, dans le navigateur.
 */
export function estFormateurAdmin(roles: readonly AppRole[]): boolean {
  return roles.includes('formateur') && (roles.includes('admin') || roles.includes('owner'));
}

export function estFormateurEmploye(roles: readonly AppRole[]): boolean {
  return roles.includes('formateur') && !estFormateurAdmin(roles);
}

/** Le nom du profil, pour les écrans qui listent les comptes. */
export function libelleProfilFormateur(roles: readonly AppRole[]): string | null {
  if (estFormateurAdmin(roles)) return 'Formateur admin';
  if (roles.includes('formateur')) return 'Formateur employé';
  return null;
}
