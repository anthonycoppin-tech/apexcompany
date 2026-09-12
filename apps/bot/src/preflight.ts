/**
 * Diagnostic de mise en service Discord. Ne modifie rien — ni le serveur
 * Discord, ni la base : que des lectures.
 *
 * Il existe parce que la mise en service Discord échoue presque toujours pour
 * l'une de quatre raisons, et que trois d'entre elles produisent le même
 * symptôme illisible (un 403 sur chaque attribution, file qui se remplit
 * d'échecs) : le bot n'est pas sur le serveur, il n'a pas « Gérer les rôles »,
 * ou son rôle est trop bas dans la hiérarchie. Ce dernier est le piège
 * classique — Discord refuse d'attribuer un rôle situé au-dessus du plus haut
 * rôle du bot, et aucune ligne de code ne peut le contourner.
 *
 * Lancer `npm run discord:check` AVANT de démarrer le worker pour la première
 * fois : la file ne se salit pas d'échecs qu'il faudra ensuite relancer à la
 * main.
 */
import './env-loader.js';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@apex/db';

const API = 'https://discord.com/api/v10';

/** `Manage Roles` — la seule permission dont le worker a besoin. */
const GERER_LES_ROLES = 1n << 28n;
const ADMINISTRATEUR = 1n << 3n;

type RoleDiscord = {
  id: string;
  name: string;
  position: number;
  permissions: string;
  managed: boolean;
};

let echecs = 0;
let alertes = 0;

function ok(message: string) {
  console.log(`  ✓ ${message}`);
}

function echec(message: string, remede?: string) {
  echecs += 1;
  console.log(`  ✗ ${message}`);
  if (remede) console.log(`    → ${remede}`);
}

function alerte(message: string, remede?: string) {
  alertes += 1;
  console.log(`  ! ${message}`);
  if (remede) console.log(`    → ${remede}`);
}

function titre(texte: string) {
  console.log(`\n${texte}`);
}

async function discord<T>(chemin: string, token: string): Promise<T | { _erreur: number }> {
  const reponse = await fetch(`${API}${chemin}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!reponse.ok) return { _erreur: reponse.status };
  return (await reponse.json()) as T;
}

function estErreur<T>(valeur: T | { _erreur: number }): valeur is { _erreur: number } {
  return typeof valeur === 'object' && valeur !== null && '_erreur' in valeur;
}

async function main() {
  console.log('Diagnostic de la mise en service Discord — lecture seule.\n');

  // 1. Les variables ─────────────────────────────────────────────────────
  titre("1. Variables d'environnement (apps/bot/.env)");

  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Lue par le site, pas par le worker : elle vit dans apps/web/.env.local.
  // On la vérifie ici quand même, parce que c'est le même serveur Discord et
  // que l'oublier ne se voit qu'à la première liaison de compte ratée.
  const roleInvite = process.env.DISCORD_ROLE_INVITE_ID;

  for (const [nom, valeur] of [
    ['DISCORD_BOT_TOKEN', token],
    ['DISCORD_GUILD_ID', guildId],
    ['NEXT_PUBLIC_SUPABASE_URL', supabaseUrl],
    ['SUPABASE_SERVICE_ROLE_KEY', serviceKey],
  ] as const) {
    if (valeur) ok(`${nom} renseignée`);
    else echec(`${nom} absente`, 'Copier apps/bot/.env.example en apps/bot/.env et la remplir.');
  }

  if (roleInvite) ok('DISCORD_ROLE_INVITE_ID renseignée');
  else
    alerte(
      'DISCORD_ROLE_INVITE_ID absente de apps/bot/.env',
      "Le worker n'en a pas besoin, mais le site oui (apps/web/.env.local) : sans elle, aucun compte lié ne reçoit le rôle « invité ».",
    );

  if (!token || !guildId) {
    console.log("\nImpossible d'aller plus loin sans le jeton et l'identifiant du serveur.");
    process.exit(1);
  }

  // 2. Le jeton ──────────────────────────────────────────────────────────
  titre('2. Application Discord');

  const moi = await discord<{ id: string; username: string }>('/users/@me', token);
  if (estErreur(moi)) {
    echec(
      `Le jeton est refusé par Discord (HTTP ${moi._erreur})`,
      'Régénérer le jeton dans Developer Portal → Bot → Reset Token, puis le recopier dans .env.',
    );
    process.exit(1);
  }
  ok(`Jeton valide — bot « ${moi.username} » (${moi.id})`);

  // 3. Le serveur ────────────────────────────────────────────────────────
  titre('3. Serveur');

  const serveur = await discord<{ id: string; name: string }>(`/guilds/${guildId}`, token);
  if (estErreur(serveur)) {
    echec(
      serveur._erreur === 404
        ? `Le bot n'est pas membre du serveur ${guildId} (ou l'identifiant est faux)`
        : `Lecture du serveur refusée (HTTP ${serveur._erreur})`,
      'Inviter le bot via Developer Portal → OAuth2 → URL Generator, scope `bot`, permission `Manage Roles`.',
    );
    process.exit(1);
  }
  ok(`Bot présent sur « ${serveur.name} »`);

  const roles = await discord<RoleDiscord[]>(`/guilds/${guildId}/roles`, token);

  if (estErreur(roles)) {
    echec(
      `Lecture des rôles du serveur refusée (HTTP ${roles._erreur})`,
      "Le bot est sur le serveur mais ne peut pas lire ses rôles : vérifier qu'il a bien « Gérer les rôles ».",
    );
    process.exit(1);
  }
  ok(`${roles.length} rôles lus sur le serveur`);

  // `/members/@me` n'existe pas pour un jeton de bot — c'est une route OAuth2
  // utilisateur. Un bot lit sa propre appartenance par son identifiant, celui
  // que `/users/@me` vient de donner.
  const membreBot = await discord<{ roles: string[] }>(
    `/guilds/${guildId}/members/${moi.id}`,
    token,
  );

  if (estErreur(membreBot)) {
    echec(
      `Appartenance du bot au serveur illisible (HTTP ${membreBot._erreur})`,
      membreBot._erreur === 404
        ? "Le bot n'apparaît pas comme membre — le réinviter via OAuth2 → URL Generator."
        : 'Sans elle, impossible de vérifier la hiérarchie des rôles, qui est le point qui casse.',
    );
    process.exit(1);
  }

  const parId = new Map(roles.map((r) => [r.id, r]));
  const rolesDuBot = membreBot.roles
    .map((id) => parId.get(id))
    .filter((r): r is RoleDiscord => !!r);
  const positionMaxBot = Math.max(0, ...rolesDuBot.map((r) => r.position));

  const permissions = rolesDuBot.reduce((acc, r) => acc | BigInt(r.permissions), 0n);
  const peutGerer =
    (permissions & GERER_LES_ROLES) === GERER_LES_ROLES ||
    (permissions & ADMINISTRATEUR) === ADMINISTRATEUR;

  if (peutGerer) ok('Permission « Gérer les rôles » accordée');
  else
    echec(
      "Le bot n'a pas la permission « Gérer les rôles »",
      'Paramètres du serveur → Rôles → rôle du bot → activer « Gérer les rôles ».',
    );

  ok(`Rôle le plus haut du bot en position ${positionMaxBot}`);

  // 4. La hiérarchie ─────────────────────────────────────────────────────
  // Le piège : Discord refuse en 403 l'attribution d'un rôle dont la position
  // est supérieure ou égale au plus haut rôle du bot. C'est une règle du
  // serveur, pas du code — d'où cette vérification rôle par rôle.
  titre('4. Rôles à attribuer, et hiérarchie');

  function verifierRole(roleId: string, libelle: string) {
    const role = parId.get(roleId);

    if (!role) {
      echec(
        `${libelle} : le rôle ${roleId} n'existe pas sur ce serveur`,
        "Vérifier l'identifiant (mode développeur → clic droit sur le rôle → Copier l'ID).",
      );
      return;
    }

    if (role.managed) {
      echec(
        `${libelle} : « ${role.name} » est un rôle géré par une intégration`,
        "Discord interdit de l'attribuer. Créer un rôle ordinaire à la place.",
      );
      return;
    }

    if (role.position >= positionMaxBot) {
      echec(
        `${libelle} : « ${role.name} » est en position ${role.position}, au-dessus du bot (${positionMaxBot})`,
        'Paramètres du serveur → Rôles → remonter le rôle du bot au-dessus de celui-ci. Sinon : 403 à chaque attribution.',
      );
      return;
    }

    ok(`${libelle} : « ${role.name} » attribuable (position ${role.position})`);
  }

  if (roleInvite) verifierRole(roleInvite, 'Rôle « invité »');
  else alerte('Rôle « invité » non vérifié — DISCORD_ROLE_INVITE_ID absente');

  // 5. Le catalogue ──────────────────────────────────────────────────────
  titre('5. Produits du catalogue et leur rôle');

  if (!supabaseUrl || !serviceKey) {
    alerte('Catalogue non vérifié — variables Supabase absentes');
  } else {
    const supabase = createClient<Database>(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: produits, error } = await supabase
      .from('formations')
      .select('titre, slug, actif, discord_role_id')
      .order('ordre');

    if (error) {
      echec(`Lecture du catalogue impossible : ${error.message}`);
    } else if (!produits?.length) {
      alerte('Aucun produit dans le catalogue');
    } else {
      for (const produit of produits) {
        if (!produit.discord_role_id) {
          // Un brouillon sans rôle est normal ; un produit actif sans rôle
          // encaisse un paiement sans jamais ouvrir d'accès.
          if (produit.actif)
            echec(
              `« ${produit.titre} » est actif et n'a aucun rôle Discord`,
              'Le renseigner dans /admin/formations, ou dépublier le produit.',
            );
          else ok(`« ${produit.titre} » — brouillon sans rôle, sans conséquence`);
          continue;
        }
        verifierRole(produit.discord_role_id, `« ${produit.titre} »`);
      }
    }

    // 6. L'état de la file ───────────────────────────────────────────────
    titre('6. File de synchronisation');

    const { data: file, error: erreurFile } = await supabase
      .from('discord_sync_queue')
      .select('statut');

    if (erreurFile) {
      echec(`Lecture de la file impossible : ${erreurFile.message}`);
    } else {
      const parStatut = new Map<string, number>();
      for (const ligne of file ?? [])
        parStatut.set(ligne.statut, (parStatut.get(ligne.statut) ?? 0) + 1);

      if (!file?.length) ok('File vide');
      else
        for (const [statut, nombre] of parStatut)
          console.log(`  · ${nombre} ligne(s) en « ${statut} »`);

      const abandonnees = parStatut.get('abandonne') ?? 0;
      if (abandonnees)
        alerte(
          `${abandonnees} ligne(s) abandonnée(s) — autant d'accès jamais ouverts`,
          'Les reprendre depuis /admin/logs une fois la cause corrigée.',
        );
    }
  }

  // Verdict ──────────────────────────────────────────────────────────────
  console.log('');
  if (echecs) {
    console.log(`${echecs} problème(s) bloquant(s), ${alertes} avertissement(s).`);
    console.log('Ne pas démarrer le worker avant de les avoir corrigés.');
    process.exit(1);
  }

  console.log(
    alertes
      ? `Aucun problème bloquant, ${alertes} avertissement(s). Le worker peut démarrer.`
      : 'Tout est en place. Le worker peut démarrer.',
  );
}

main().catch((err) => {
  console.error("\nLe diagnostic s'est arrêté sur une erreur :", err);
  process.exit(1);
});
