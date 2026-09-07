/**
 * Worker qui consomme `discord_sync_queue`. Non testé en conditions réelles —
 * contrairement au reste du dépôt, aucune application Discord n'existe encore
 * (il faut DISCORD_BOT_TOKEN et DISCORD_GUILD_ID, voir apps/bot/README.md).
 * La logique est écrite au plus près du schéma (supabase/migrations/…) et
 * vérifiée par le typecheck, mais mérite un test contre un vrai serveur
 * Discord de test avant la phase 4.
 */
import './env-loader.js';

import { accorderRole, retirerRole, LimiteDeDebit, MembreIntrouvable } from './discord.js';
import { supabase } from './supabase.js';

import type { Database } from '@apex/db';

type LigneFile = Database['public']['Tables']['discord_sync_queue']['Row'];

const TAILLE_LOT = 10;
const INTERVALLE_FILE_VIDE_MS = 5_000;
const TENTATIVES_MAX = 5;

/** Backoff croissant : 30s, 2min, 10min, 30min, 1h — plafonné à 1h. */
function prochainEssaiApres(tentatives: number): Date {
  const paliers = [30, 120, 600, 1800, 3600];
  const secondes = paliers[Math.min(tentatives, paliers.length - 1)] ?? 3600;
  return new Date(Date.now() + secondes * 1000);
}

async function reclamerLot(): Promise<LigneFile[]> {
  const { data: candidats, error: erreurLecture } = await supabase
    .from('discord_sync_queue')
    .select('*')
    .in('statut', ['en_attente', 'echoue'])
    .lte('prochain_essai', new Date().toISOString())
    .order('prochain_essai', { ascending: true })
    .limit(TAILLE_LOT);

  if (erreurLecture) throw erreurLecture;
  if (!candidats || candidats.length === 0) return [];

  // Deux étapes plutôt qu'un `for update skip locked` : PostgREST ne
  // l'expose pas. Le filtre `.in('statut', ...)` en deuxième étape rend le
  // pire cas correct pour une seule instance du worker (le cas prévu ici) ;
  // avant de faire tourner plusieurs instances en parallèle, remplacer ceci
  // par une fonction RPC qui fait le SELECT ... FOR UPDATE SKIP LOCKED côté
  // Postgres, atomique par construction.
  const ids = candidats.map((c) => c.id);
  const { data: reclames, error: erreurClaim } = await supabase
    .from('discord_sync_queue')
    .update({ statut: 'en_cours' })
    .in('id', ids)
    .in('statut', ['en_attente', 'echoue'])
    .select('*');

  if (erreurClaim) throw erreurClaim;
  return reclames ?? [];
}

async function journaliserAbandon(ligne: LigneFile, erreur: string) {
  await supabase.from('automation_logs').insert({
    declencheur: 'discord_sync_queue',
    entite_type: 'discord_sync_queue',
    entite_id: ligne.id,
    statut: 'echec',
    details: { user_id: ligne.user_id, action: ligne.action, role_id: ligne.role_id, erreur },
  });
}

async function mettreAJourLienRoles(userId: string, roleId: string, action: 'grant' | 'revoke') {
  const { data: lien } = await supabase
    .from('discord_links')
    .select('discord_user_id, roles_attribues')
    .eq('user_id', userId)
    .maybeSingle();

  if (!lien) return null;

  const rolesActuels = Array.isArray(lien.roles_attribues)
    ? (lien.roles_attribues as string[])
    : [];
  const rolesMisAJour =
    action === 'grant'
      ? [...new Set([...rolesActuels, roleId])]
      : rolesActuels.filter((r) => r !== roleId);

  await supabase
    .from('discord_links')
    .update({ roles_attribues: rolesMisAJour, derniere_sync: new Date().toISOString() })
    .eq('user_id', userId);

  return lien.discord_user_id;
}

async function traiterLigne(ligne: LigneFile): Promise<'pause_globale' | void> {
  const { data: lien } = await supabase
    .from('discord_links')
    .select('discord_user_id')
    .eq('user_id', ligne.user_id)
    .maybeSingle();

  if (!lien) {
    await echouer(ligne, 'Compte Discord non lié (aucune ligne dans discord_links)');
    return;
  }

  const raison = `ApexCompany — synchronisation ${ligne.action} (file ${ligne.id})`;

  try {
    if (ligne.action === 'grant') {
      await accorderRole(lien.discord_user_id, ligne.role_id, raison);
    } else {
      await retirerRole(lien.discord_user_id, ligne.role_id, raison);
    }

    await mettreAJourLienRoles(ligne.user_id, ligne.role_id, ligne.action);

    await supabase
      .from('discord_sync_queue')
      .update({ statut: 'reussi', traite_at: new Date().toISOString(), erreur: null })
      .eq('id', ligne.id);
  } catch (err) {
    if (err instanceof LimiteDeDebit) {
      // Pas une faute de cette ligne : on la relâche sans compter de
      // tentative, et on interrompt le lot entier — la limite est globale
      // au bot, continuer à taper dessus l'aggrave.
      await supabase
        .from('discord_sync_queue')
        .update({
          statut: 'en_attente',
          prochain_essai: new Date(Date.now() + err.retryAfterMs).toISOString(),
        })
        .eq('id', ligne.id);
      return 'pause_globale';
    }

    if (err instanceof MembreIntrouvable) {
      // Aucun nombre de tentatives ne fait rejoindre le serveur à quelqu'un :
      // abandon immédiat plutôt que d'épuiser TENTATIVES_MAX pour rien.
      await abandonner(ligne, err.message);
      return;
    }

    await echouer(ligne, err instanceof Error ? err.message : String(err));
  }
}

async function echouer(ligne: LigneFile, message: string) {
  const tentatives = ligne.tentatives + 1;

  if (tentatives >= TENTATIVES_MAX) {
    await abandonner(ligne, message, tentatives);
    return;
  }

  await supabase
    .from('discord_sync_queue')
    .update({
      statut: 'echoue',
      tentatives,
      erreur: message,
      prochain_essai: prochainEssaiApres(tentatives).toISOString(),
    })
    .eq('id', ligne.id);
}

async function abandonner(ligne: LigneFile, message: string, tentatives = ligne.tentatives) {
  await supabase
    .from('discord_sync_queue')
    .update({ statut: 'abandonne', tentatives, erreur: message })
    .eq('id', ligne.id);

  await journaliserAbandon(ligne, message);
}

async function boucle() {
  for (;;) {
    const lot = await reclamerLot();

    if (lot.length === 0) {
      await new Promise((r) => setTimeout(r, INTERVALLE_FILE_VIDE_MS));
      continue;
    }

    for (const ligne of lot) {
      const resultat = await traiterLigne(ligne);
      if (resultat === 'pause_globale') break;
    }
  }
}

console.log('Worker Discord démarré — écoute de discord_sync_queue.');
boucle().catch((err) => {
  console.error("Le worker s'est arrêté sur une erreur non récupérée :", err);
  process.exit(1);
});
