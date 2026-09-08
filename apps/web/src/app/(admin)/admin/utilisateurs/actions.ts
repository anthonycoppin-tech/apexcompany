'use server';

import { revalidatePath } from 'next/cache';

import { ROLES, type AppRole } from '@apex/db';

import { createClient } from '@/lib/supabase/server';

export type EtatRole = { readonly erreur: string | null; readonly ok: boolean };

/**
 * Accorder ou retirer un rôle.
 *
 * **Écrit sous RLS, et c'est tout l'intérêt.** `user_roles_owner_ecrit`
 * n'autorise l'écriture qu'à un `owner` : un admin qui appellerait cette action
 * directement se ferait refuser par le moteur, pas par un `if` dans ce fichier.
 * L'écran désactive les boutons pour les non-owners, mais c'est du confort — la
 * garantie est dans la politique.
 *
 * C'est la raison pour laquelle les rôles vivent dans leur propre table et
 * jamais dans `profiles` ni dans les métadonnées du JWT : une colonne de rôle
 * éditable par le porteur du compte est une élévation de privilège offerte.
 *
 * La trace est automatique — un trigger `audit_user_roles` écrit chaque
 * attribution et chaque retrait dans `audit_logs`, que seul un owner relit.
 */
export async function changerRole(_precedent: EtatRole, donnees: FormData): Promise<EtatRole> {
  const userId = (donnees.get('user_id') ?? '').toString();
  const role = (donnees.get('role') ?? '').toString();
  const sens = (donnees.get('sens') ?? '').toString();

  if (!userId) return { erreur: 'Compte introuvable.', ok: false };
  if (!ROLES.includes(role as AppRole)) return { erreur: 'Rôle inconnu.', ok: false };
  if (sens !== 'accorder' && sens !== 'retirer') {
    return { erreur: 'Action inconnue.', ok: false };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { erreur: 'Session expirée.', ok: false };

  // Un owner qui se retirerait son propre rôle `owner` fermerait la porte
  // derrière lui : plus personne ne pourrait gérer les rôles, et il n'y a pas
  // d'écran de secours. Le refus est ici parce que la RLS, elle, ne voit qu'une
  // écriture parfaitement légitime.
  if (sens === 'retirer' && role === 'owner' && userId === user.id) {
    return {
      erreur:
        'Tu ne peux pas retirer ton propre rôle owner : personne ne pourrait plus gérer les rôles. Demande à un autre owner.',
      ok: false,
    };
  }

  const requete =
    sens === 'accorder'
      ? supabase
          .from('user_roles')
          .insert({ user_id: userId, role: role as AppRole, granted_by: user.id })
      : supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role as AppRole);

  const { error } = await requete;

  if (error) {
    // La contrainte d'unicité `(user_id, role)` rend l'attribution idempotente :
    // un double clic ne crée pas deux lignes, il échoue proprement.
    const dejaLa = error.code === '23505';

    return {
      erreur: dejaLa
        ? 'Ce rôle est déjà attribué.'
        : 'L’opération a échoué. Seul un owner peut modifier les rôles.',
      ok: false,
    };
  }

  revalidatePath('/admin/utilisateurs');

  return { erreur: null, ok: true };
}
