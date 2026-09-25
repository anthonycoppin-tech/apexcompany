'use server';

import { revalidatePath } from 'next/cache';

import { type AppRole } from '@apex/db';

import { requireRole } from '@/lib/auth/roles';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const PROFILS: Record<string, readonly AppRole[]> = {
  formateur: ['formateur'],
  formateur_admin: ['formateur', 'admin'],
  admin: ['admin'],
};

/**
 * Créer le compte d'un membre de l'équipe, rôles compris.
 *
 * Demandé le 25 septembre 2026 : jusque-là, un compte d'équipe ne se créait que
 * par le tableau de bord Supabase, et « Fiches formateurs » — qui n'est que la
 * présentation publique — passait pour l'endroit où ajouter un formateur.
 *
 * **Deux verrous, parce que la création passe par la clé de service** (hors
 * RLS) : `requireRole(['owner'])` d'abord — une action serveur est une API
 * publique —, puis les rôles écrits **à session**, sous
 * `user_roles_owner_ecrit`. Si l'appelant n'était pas owner, la base
 * refuserait encore les rôles.
 *
 * Le mot de passe provisoire est facultatif : sans lui, la personne se connecte
 * par lien email, comme un client. Il est utile tant que l'envoi d'emails
 * n'est pas branché, puisqu'aucun lien ne partirait.
 */
export async function ajouterMembre(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  await requireRole(['owner']);

  const lu = (champ: string) => (donnees.get(champ) ?? '').toString().trim();
  const email = lu('email').toLowerCase();
  const prenom = lu('prenom');
  const nom = lu('nom');
  const motDePasse = (donnees.get('mot_de_passe') ?? '').toString();
  const roles = PROFILS[lu('profil')];

  if (!prenom) return echoue('Le prénom est nécessaire.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return echoue('Cette adresse n’est pas valide.');
  if (!roles) return echoue('Choisissez un profil.');
  if (motDePasse && motDePasse.length < 12) {
    return echoue('Le mot de passe provisoire doit faire au moins 12 caractères.');
  }

  const admin = createServiceRoleClient();
  const { data: compte, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    ...(motDePasse ? { password: motDePasse } : {}),
    user_metadata: { prenom },
  });

  if (error || !compte.user) {
    return echoue(
      error?.message?.toLowerCase().includes('already')
        ? 'Cette adresse est déjà utilisée — par un compte ou par le Discord relié à un compte. Si c’est le sien, donnez-lui ses rôles dans le tableau ci-dessous.'
        : 'La création du compte a échoué. Réessayez dans un instant.',
    );
  }

  const userId = compte.user.id;
  if (nom) await admin.from('profiles').update({ nom }).eq('id', userId);

  const supabase = await createClient();
  const {
    data: { user: moi },
  } = await supabase.auth.getUser();

  const { error: erreurRoles } = await supabase
    .from('user_roles')
    .insert(roles.map((role) => ({ user_id: userId, role, granted_by: moi?.id ?? null })));

  // Le déclencheur de création donne `client` à tout nouveau compte. Un compte
  // de l'équipe n'en veut pas : `/espace` lui serait ouvert, et il compterait
  // parmi les clients.
  await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'client');

  revalidatePath('/admin/utilisateurs');

  if (erreurRoles) {
    return echoue(
      'Le compte est créé, mais ses rôles n’ont pas pu être attribués. Donnez-les dans le tableau ci-dessous.',
    );
  }

  return reussi(
    motDePasse
      ? `Compte créé. ${prenom} se connecte sur /connexion avec son email et ce mot de passe.`
      : `Compte créé. ${prenom} se connecte sur /connexion en recevant un lien par email.`,
  );
}
