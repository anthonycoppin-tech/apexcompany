import { redirect } from 'next/navigation';

import { ROLES_STAFF, type AppRole } from '@apex/db';

import { createClient } from '@/lib/supabase/server';

/**
 * Rôles de l'utilisateur courant, lus via la RLS de `user_roles`
 * (politique `user_roles_lit_les_siens`). Tableau vide si non connecté.
 *
 * Volontairement redondant avec la RLS plutôt qu'un remplacement : cette
 * fonction sert à décider quoi AFFICHER (rediriger, montrer un menu). Ce que
 * l'utilisateur peut réellement LIRE OU ÉCRIRE reste décidé par les
 * politiques RLS sur chaque table, pas par ce résultat.
 */
export async function getUserRoles(): Promise<AppRole[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', user.id);

  if (error) throw error;

  return data.map((r) => r.role);
}

/**
 * Garde de layout : redirige vers /connexion si non authentifié, vers /
 * si authentifié mais sans aucun des rôles autorisés. À poser dans les
 * layouts de (espace) et (admin), pas dans chaque page individuellement.
 */
export async function requireRole(rolesAutorises: readonly AppRole[]): Promise<AppRole[]> {
  const roles = await getUserRoles();

  if (roles.length === 0) {
    redirect('/connexion');
  }

  if (!roles.some((r) => rolesAutorises.includes(r))) {
    redirect('/');
  }

  return roles;
}

export function estStaff(roles: readonly AppRole[]): boolean {
  return roles.some((r) => (ROLES_STAFF as readonly AppRole[]).includes(r));
}
