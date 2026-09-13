/**
 * Réconciliation des rôles Discord — rattrape les accès qui auraient dû être
 * accordés et ne l'ont pas été.
 *
 * **Pourquoi elle existe.** L'attribution est un événement ponctuel : un
 * `grant` empilé au paiement, un autre à la liaison du compte. Ces deux
 * instants passent une fois et ne repassent jamais. La révocation, elle, a sa
 * tâche quotidienne — l'attribution n'avait rien. Quatre situations font donc
 * diverger la base et Discord, définitivement :
 *
 * 1. le `grant` n'a jamais été empilé (une variable manquante, arrivé le
 *    12 septembre 2026) ;
 * 2. il a été empilé puis abandonné — `MembreIntrouvable` abandonne sans
 *    réessai, donc payer avant d'avoir rejoint le serveur suffit à tout perdre ;
 * 3. **le membre quitte le serveur et revient** : Discord efface ses rôles, et
 *    notre registre continue d'affirmer qu'il les a ;
 * 4. un modérateur retire un rôle à la main.
 *
 * Le worker arrêté, lui, n'est pas un cas perdu : la ligne attend dans la file.
 *
 * **On compare à l'état réel de Discord, pas à notre registre.** Comparer les
 * inscriptions à `discord_links.roles_attribues` reviendrait à confronter notre
 * croyance à elle-même : le cas 3 y est invisible par construction. D'où un
 * `GET` par compte lié — quelques centaines d'appels par passage, sans commune
 * mesure avec les limites de Discord. Si le volume l'exigeait un jour, l'intent
 * privilégié « Server Members » ouvre la lecture par millier.
 *
 * **Elle n'accorde jamais que ce qui manque, et ne retire rien.** Le retrait
 * est le métier de `revoquer_acces_expires()`, qui décide sur la date de fin
 * d'accès. Ici, une lecture incomplète coûterait son accès à un client qui
 * paie — la panne la plus visible qui soit.
 *
 * **Et elle ne regarde que les rôles qu'elle gère** : `invité` et les
 * `formations.discord_role_id`. Tout le reste — modération, couleurs,
 * décoration — ne la concerne pas. Un bot qui « remet l'état conforme » sans
 * cette limite dépouille les modérateurs au premier passage.
 */
import './env-loader.js';

import { pathToFileURL } from 'node:url';

import { LimiteDeDebit, lireRolesDuMembre } from './discord.js';
import { supabase } from './supabase.js';

/** Pause entre deux lectures, pour ne pas arriver sur la limite de débit. */
const PAUSE_ENTRE_MEMBRES_MS = 250;

type Attendu = { userId: string; discordUserId: string; roles: Set<string> };

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ce que chaque compte lié devrait porter : le rôle `invité`, que tout compte
 * reçoit à la liaison et ne perd jamais, plus un rôle par inscription active.
 */
async function etatAttendu(): Promise<Attendu[]> {
  const roleInvite = process.env.DISCORD_ROLE_INVITE_ID;

  const { data: liens, error: erreurLiens } = await supabase
    .from('discord_links')
    .select('user_id, discord_user_id');

  if (erreurLiens) throw erreurLiens;
  if (!liens?.length) return [];

  // `!inner` : une inscription dont le produit n'a pas de rôle Discord n'a rien
  // à réconcilier, autant ne pas la remonter.
  const { data: inscriptions, error: erreurInscriptions } = await supabase
    .from('inscriptions')
    .select('user_id, formations!inner(discord_role_id)')
    .eq('statut', 'active')
    .not('formations.discord_role_id', 'is', null);

  if (erreurInscriptions) throw erreurInscriptions;

  const parUtilisateur = new Map<string, Attendu>();

  for (const lien of liens) {
    parUtilisateur.set(lien.user_id, {
      userId: lien.user_id,
      discordUserId: lien.discord_user_id,
      roles: new Set(roleInvite ? [roleInvite] : []),
    });
  }

  for (const inscription of inscriptions ?? []) {
    // Une inscription sans compte Discord lié n'est pas une anomalie : la
    // personne n'a simplement pas encore fait la liaison. Rien à rattraper.
    const entree = parUtilisateur.get(inscription.user_id);
    const role = (inscription.formations as { discord_role_id: string | null } | null)
      ?.discord_role_id;

    if (entree && role) entree.roles.add(role);
  }

  return [...parUtilisateur.values()];
}

/**
 * Les rôles déjà en file pour cet utilisateur, qu'il est inutile de réempiler.
 *
 * **`reussi` n'en fait délibérément pas partie**, contrairement à la garde de
 * `api/discord/callback`. Là-bas, elle empêche un reclic de gonfler la file.
 * Ici, un `grant` réussi hier et un rôle absent aujourd'hui est précisément ce
 * qu'on cherche : c'est le membre qui est parti et revenu.
 */
async function dejaEnFile(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('discord_sync_queue')
    .select('role_id')
    .eq('user_id', userId)
    .eq('action', 'grant')
    .in('statut', ['en_attente', 'en_cours', 'echoue']);

  return new Set((data ?? []).map((l) => l.role_id));
}

export async function reconcilier() {
  if (!process.env.DISCORD_ROLE_INVITE_ID) {
    console.warn(
      'DISCORD_ROLE_INVITE_ID absente : le rôle « invité » ne sera pas réconcilié.\n' +
        'La renseigner dans apps/bot/.env — et dans apps/web/.env.local, que lit le site.',
    );
  }

  const attendus = await etatAttendu();

  let lus = 0;
  let absents = 0;
  let empiles = 0;
  const manques: Array<{ user_id: string; role_id: string }> = [];
  const identifiantsAbsents: string[] = [];

  for (const attendu of attendus) {
    if (attendu.roles.size === 0) continue;

    let reels: string[] | null;

    try {
      reels = await lireRolesDuMembre(attendu.discordUserId);
    } catch (err) {
      if (err instanceof LimiteDeDebit) {
        // La limite est globale au bot : insister l'aggrave. On attend le
        // délai annoncé et on reprend ce même membre.
        await dormir(err.retryAfterMs);
        reels = await lireRolesDuMembre(attendu.discordUserId);
      } else {
        throw err;
      }
    }

    if (reels === null) {
      // Compte lié mais pas membre du serveur. Empiler un `grant` ne
      // produirait qu'un `MembreIntrouvable` de plus, abandonné aussitôt.
      //
      // On retient QUI, pas seulement combien : c'est la seule source de cette
      // information — la base ne peut pas savoir qui est présent sur Discord —
      // et sans les identités, le tableau de bord ne peut afficher qu'un
      // nombre, que personne ne sait par quel bout prendre.
      absents += 1;
      identifiantsAbsents.push(attendu.userId);
      continue;
    }

    lus += 1;

    const porte = new Set(reels);
    const aAccorder = [...attendu.roles].filter((r) => !porte.has(r));

    if (aAccorder.length) {
      const enFile = await dejaEnFile(attendu.userId);
      const aEmpiler = aAccorder.filter((r) => !enFile.has(r));

      for (const role of aEmpiler) {
        manques.push({ user_id: attendu.userId, role_id: role });
      }
    }

    await dormir(PAUSE_ENTRE_MEMBRES_MS);
  }

  if (manques.length) {
    const { error } = await supabase
      .from('discord_sync_queue')
      .insert(manques.map((m) => ({ ...m, action: 'grant' as const })));

    if (error) throw error;
    empiles = manques.length;
  }

  // Consignée même quand elle ne trouve rien — comme la révocation, et pour la
  // même raison : un journal vide ne distingue pas « tout est conforme » de
  // « plus rien ne s'exécute depuis trois semaines ».
  await supabase.from('automation_logs').insert({
    declencheur: 'discord.reconciliation',
    statut: 'succes',
    details: {
      comptes_lies: attendus.length,
      membres_lus: lus,
      absents_du_serveur: absents,
      // Les identités, pas seulement le compte : /admin les nomme.
      absents: identifiantsAbsents,
      roles_reempiles: empiles,
    },
  });

  return { comptes: attendus.length, lus, absents, empiles };
}

// Lancé directement (`npm run discord:reconcile`) plutôt qu'importé : la passe
// est un travail ponctuel, qu'un planificateur peut appeler comme il appelle
// déjà `api/cron/revocation`.
//
// `pathToFileURL` plutôt qu'une comparaison de chaînes bricolée : sous Windows,
// `file://` collé à `C:/Users/...` donne deux barres là où `import.meta.url` en
// met trois, et la garde ne matche jamais — le script se terminait sans rien
// faire ni rien dire.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  reconcilier()
    .then((r) => {
      console.log(
        `Réconciliation terminée — ${r.comptes} compte(s) lié(s), ${r.lus} lu(s) sur le serveur, ` +
          `${r.absents} absent(s), ${r.empiles} rôle(s) réempilé(s).`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error('La réconciliation a échoué :', err);
      process.exit(1);
    });
}
