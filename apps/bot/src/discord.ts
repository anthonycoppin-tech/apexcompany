import { env } from './env.js';

const API = 'https://discord.com/api/v10';

export class MembreIntrouvable extends Error {}
export class LimiteDeDebit extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`Rate limit Discord, réessayer dans ${retryAfterMs}ms`);
  }
}

/**
 * Un seul appel REST par action, pas de connexion au Gateway : le bot n'a
 * besoin ni d'écouter les événements Discord, ni de maintenir un websocket.
 * La liaison de compte (discord_links) se fait côté web via l'OAuth Discord
 * de Supabase Auth ; le worker ne fait qu'accorder ou retirer un rôle.
 */
async function appelDiscord(method: 'PUT' | 'DELETE', chemin: string, raison: string) {
  const reponse = await fetch(`${API}${chemin}`, {
    method,
    headers: {
      Authorization: `Bot ${env.discordBotToken}`,
      'X-Audit-Log-Reason': raison,
    },
  });

  if (reponse.status === 204) return;

  if (reponse.status === 429) {
    const corps = (await reponse.json().catch(() => ({}))) as { retry_after?: number };
    const retryAfterMs = Math.ceil((corps.retry_after ?? 5) * 1000);
    throw new LimiteDeDebit(retryAfterMs);
  }

  if (reponse.status === 404) {
    // Le membre a quitté le serveur, ou ne l'a jamais rejoint : aucun
    // nombre de tentatives ne résoudra ça, il faut une action humaine
    // (docs/06-PERIMETRE.md ne couvre pas ce cas — à trancher : relance
    // automatique de l'invite ? alerte dans admin/logs ?).
    throw new MembreIntrouvable(`Membre ${chemin} introuvable sur le serveur Discord`);
  }

  const corps = await reponse.text().catch(() => '');
  throw new Error(`Discord ${method} ${chemin} -> HTTP ${reponse.status} : ${corps}`);
}

export async function accorderRole(discordUserId: string, roleId: string, raison: string) {
  await appelDiscord(
    'PUT',
    `/guilds/${env.discordGuildId}/members/${discordUserId}/roles/${roleId}`,
    raison,
  );
}

export async function retirerRole(discordUserId: string, roleId: string, raison: string) {
  await appelDiscord(
    'DELETE',
    `/guilds/${env.discordGuildId}/members/${discordUserId}/roles/${roleId}`,
    raison,
  );
}
