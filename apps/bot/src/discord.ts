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
      // Encodé, et pas seulement par prudence : une valeur d'en-tête HTTP est
      // une ByteString, donc du latin-1. Le tiret cadratin de « ApexCompany —
      // synchronisation » faisait lever `fetch` AVANT le moindre appel réseau,
      // et chaque ligne de la file échouait sur une erreur qui ne parlait ni
      // de Discord ni de permissions. Discord attend justement de l'UTF-8
      // percent-encodé ici, et le décode pour son journal d'audit.
      'X-Audit-Log-Reason': encodeURIComponent(raison),
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

/**
 * Les rôles que le membre porte **réellement** sur le serveur, ou `null` s'il
 * n'y est pas.
 *
 * C'est le seul moyen de voir qu'un accès a disparu : `discord_links.roles_attribues`
 * ne dit pas ce que Discord sait, il dit ce que nous croyons avoir accordé. Un
 * membre qui quitte le serveur perd ses rôles sans que rien ne l'écrive chez
 * nous — et à son retour, notre registre affirme toujours qu'il les a.
 *
 * `null` plutôt qu'une exception pour l'absence : ne pas être sur le serveur
 * est un état normal, pas une panne. C'est même le cas de tous ceux qui ont lié
 * leur compte sans jamais rejoindre.
 */
export async function lireRolesDuMembre(discordUserId: string): Promise<string[] | null> {
  const reponse = await fetch(`${API}/guilds/${env.discordGuildId}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${env.discordBotToken}` },
  });

  if (reponse.status === 404) return null;

  if (reponse.status === 429) {
    const corps = (await reponse.json().catch(() => ({}))) as { retry_after?: number };
    throw new LimiteDeDebit(Math.ceil((corps.retry_after ?? 5) * 1000));
  }

  if (!reponse.ok) {
    const corps = await reponse.text().catch(() => '');
    throw new Error(`Discord GET member -> HTTP ${reponse.status} : ${corps}`);
  }

  const membre = (await reponse.json()) as { roles?: string[] };
  return membre.roles ?? [];
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
