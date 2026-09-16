'use server';

import { revalidatePath } from 'next/cache';

import { requireRole } from '@/lib/auth/roles';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';

/**
 * Réempile les rôles Discord dus à un client.
 *
 * **Le geste de rattrapage**, quand quelqu'un dit « j'ai payé et je n'ai pas
 * accès ». L'attribution est un événement ponctuel — un `grant` au paiement, un
 * autre à la liaison — et ces deux instants ne repassent jamais. Si l'un s'est
 * mal passé, rien ne le rattrape sans cette action ou sans
 * `npm run discord:reconcile`.
 *
 * **Elle ne lit pas Discord, et c'est délibéré.** La passe périodique du worker
 * le fait, elle, pour ne pas empiler des rôles déjà portés par des centaines de
 * membres. Ici on traite une personne : réaccorder un rôle qu'elle a déjà ne
 * coûte rien — `PUT .../roles/{id}` répond 204 dans les deux cas — et ça évite
 * de faire voyager le jeton du bot jusqu'au site, qui n'en a aucun autre usage.
 *
 * Comme la réconciliation, elle **accorde seulement**. Retirer un accès reste
 * le métier de `revoquer_acces_expires()`, qui décide sur une date.
 */
export async function reattribuerAccesDiscord(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  // Une action serveur est une API publique : la garde du layout ne la protège
  // pas, seule cette ligne le fait.
  await requireRole(['admin', 'owner']);

  const userId = (donnees.get('user_id') ?? '').toString();
  if (!userId) return echoue('Client introuvable.');

  const admin = createServiceRoleClient();

  const { data: lien } = await admin
    .from('discord_links')
    .select('discord_user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!lien) {
    return echoue(
      'Ce client n’a pas connecté son compte Discord. Aucun rôle ne peut lui être attribué tant qu’il ne l’a pas fait depuis son espace.',
    );
  }

  const roles = new Set<string>();

  // Le rôle `invité`, que tout compte lié reçoit et ne perd jamais.
  const roleInvite = process.env.DISCORD_ROLE_INVITE_ID;
  if (roleInvite) roles.add(roleInvite);

  const { data: inscriptions } = await admin
    .from('inscriptions')
    .select('formations!inner(discord_role_id)')
    .eq('user_id', userId)
    .eq('statut', 'active')
    .not('formations.discord_role_id', 'is', null);

  for (const inscription of inscriptions ?? []) {
    const role = (inscription.formations as { discord_role_id: string | null } | null)
      ?.discord_role_id;
    if (role) roles.add(role);
  }

  if (roles.size === 0) {
    return echoue(
      'Aucun rôle à attribuer : ce client n’a aucun accès actif, et le rôle « invité » n’est pas configuré.',
    );
  }

  // Ce qui attend déjà dans la file n'a pas à y être réempilé. `reussi` n'entre
  // pas dans cette liste : un `grant` réussi la semaine dernière et un rôle
  // absent aujourd'hui, c'est précisément le cas qu'on vient rattraper.
  const { data: enFile } = await admin
    .from('discord_sync_queue')
    .select('role_id')
    .eq('user_id', userId)
    .eq('action', 'grant')
    .in('statut', ['en_attente', 'en_cours', 'echoue']);

  const dejaEmpiles = new Set((enFile ?? []).map((l) => l.role_id));
  const aEmpiler = [...roles].filter((r) => !dejaEmpiles.has(r));

  if (aEmpiler.length === 0) {
    return reussi('Tout est déjà en file d’attente. Le worker traitera ces rôles dans la minute.');
  }

  const { error } = await admin
    .from('discord_sync_queue')
    .insert(aEmpiler.map((role_id) => ({ user_id: userId, action: 'grant' as const, role_id })));

  if (error) {
    return echoue(`L’enregistrement a échoué : ${error.message}`);
  }

  await admin.from('automation_logs').insert({
    declencheur: 'discord.reattribution_manuelle',
    entite_type: 'discord_links',
    entite_id: userId,
    statut: 'succes',
    details: { roles: aEmpiler },
  });

  revalidatePath(`/admin/clients/${userId}`);

  return reussi(
    `${aEmpiler.length} rôle(s) remis en file. Ils arrivent dans la minute si le worker tourne.`,
  );
}
