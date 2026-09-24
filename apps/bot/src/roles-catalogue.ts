/**
 * Crée sur le serveur Discord le rôle qui manque à chaque produit du
 * catalogue, et écrit son identifiant dans `formations.discord_role_id`.
 *
 * **Pourquoi ce script existe.** Un produit ne peut pas être publié sans
 * `discord_role_id` — la base le refuse, et c'est voulu : il encaisserait un
 * paiement sans ouvrir d'accès. Les neuf produits réels livrés par le client le
 * 23 septembre 2026 sont donc en brouillon, et le site continue d'afficher les
 * produits du jeu d'essai. La seule chose qui manque est un identifiant par
 * produit, et un identifiant Discord ne s'invente pas : c'est un nombre attribué
 * par Discord au moment où le rôle est créé sur un vrai serveur.
 *
 * Le saisir à la main, c'est neuf allers-retours entre le serveur et
 * `/admin/formations`, et une faute de frappe qui ne se verrait qu'au premier
 * paiement — un rôle inexistant se solde par un 404 dans la file, pas par un
 * message à l'écran.
 *
 * ── Ce qu'il fait, dans cet ordre ───────────────────────────────────────────
 *
 * 1. lit les produits sans rôle (`discord_role_id is null`) ;
 * 2. lit les rôles existants du serveur ;
 * 3. **réutilise le rôle qui porte déjà ce nom** plutôt que d'en créer un
 *    second — sans quoi une deuxième exécution doublerait tout ;
 * 4. crée les autres, **sans aucune permission** ;
 * 5. écrit l'identifiant dans la fiche produit.
 *
 * ── Trois choix qui méritent leur ligne ────────────────────────────────────
 *
 * **Le rôle porte le titre du produit, à l'identique** — sauf les deux que
 * `ROLE_PAR_SLUG` réunit plus bas. Pas de préfixe, pas d'abréviation : c'est le
 * nom que le client lit dans son back-office, celui qui figure sur sa facture,
 * et celui qu'il verra dans la liste des rôles du serveur. Le code, lui, ne
 * compare jamais que des identifiants — le nom n'est là que pour les humains,
 * et c'est précisément pour eux qu'il doit être évident.
 *
 * **Le rôle est créé sans permission** (`permissions: '0'`). Un rôle d'accès
 * n'a pas à pouvoir faire quoi que ce soit : ce qu'il ouvre se règle sur les
 * salons, un par un. Un rôle créé avec des permissions par défaut donnerait à
 * chaque client payant des droits que personne n'a décidés.
 *
 * **Il n'est ni affiché à part (`hoist`) ni mentionnable.** Neuf rôles produits
 * affichés séparément transformeraient la liste des membres en catalogue
 * tarifaire, lisible par tout le serveur : qui a payé quoi.
 *
 * ── Simulation par défaut ──────────────────────────────────────────────────
 *
 *   npm run discord:roles              # dit ce qu'il ferait, ne touche à rien
 *   npm run discord:roles -- --appliquer
 *   npm run discord:roles -- --appliquer --publier
 *
 * `--publier` met en vente les produits qui ont désormais leur rôle. C'est le
 * seul geste éditorial du lot, donc il se demande explicitement.
 */

import './env-loader.js';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@apex/db';

const API = 'https://discord.com/api/v10';

type RoleDiscord = { id: string; name: string };

/**
 * Le rôle qui ouvre l'accès à un produit, quand ce n'est pas simplement son
 * titre.
 *
 * **Un rôle peut servir deux produits**, et c'est ici le cas voulu : APEX PRIME
 * se vend au mois et à l'année, mais c'est le même accès — deux rôles
 * donneraient deux salons pour la même chose, et un client qui passe du mensuel
 * à l'annuel en porterait deux.
 *
 * Ce partage est sûr par construction : `revoquer_acces_expires()` vérifie,
 * avant chaque retrait, qu'aucune **autre inscription active du même client**
 * ne porte ce rôle — c'est son compteur `roles_conserves`. L'abonné annuel ne
 * perd donc rien quand son mensuel expire.
 *
 * **Reste une question pour le client** : APEX PARTNER et sa formule lancement
 * donnent-ils accès aux mêmes salons ? Ici, on suppose que non — deux produits
 * distincts, deux rôles. Les fusionner plus tard est une ligne dans cette
 * table ; les séparer après coup demande de reprendre les membres à la main.
 */
const ROLE_PAR_SLUG: Record<string, string> = {
  'apex-prime': 'APEX PRIME',
  'apex-prime-annuel': 'APEX PRIME',
};

const appliquer = process.argv.includes('--appliquer');
const publier = process.argv.includes('--publier');

function requis(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) {
    console.error(`Variable d'environnement manquante : ${nom}. Voir apps/bot/.env.example.`);
    process.exit(1);
  }
  return valeur;
}

async function main() {
  const token = requis('DISCORD_BOT_TOKEN');
  const guildId = requis('DISCORD_GUILD_ID');
  const supabase = createClient<Database>(
    requis('NEXT_PUBLIC_SUPABASE_URL'),
    requis('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  console.log(
    appliquer
      ? '\nCréation des rôles manquants du catalogue.\n'
      : '\nSimulation — rien ne sera créé ni écrit. Ajouter --appliquer pour agir.\n',
  );

  const { data: produits, error } = await supabase
    .from('formations')
    .select('id, titre, slug, actif, discord_role_id')
    .is('discord_role_id', null)
    .order('ordre');

  if (error) {
    console.error(`Lecture du catalogue impossible : ${error.message}`);
    process.exit(1);
  }

  if (!produits?.length) {
    console.log('  Tous les produits ont déjà leur rôle. Rien à faire.');
    return;
  }

  const reponse = await fetch(`${API}/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${token}` },
  });

  if (!reponse.ok) {
    console.error(
      `Discord refuse la lecture des rôles (HTTP ${reponse.status}). ` +
        'Lancer `npm run discord:check` : le bot est-il sur le serveur, avec « Gérer les rôles » ?',
    );
    process.exit(1);
  }

  const existants = (await reponse.json()) as RoleDiscord[];
  const parNom = new Map(existants.map((r) => [r.name, r.id]));

  let crees = 0;
  let reutilises = 0;
  let publies = 0;

  for (const produit of produits) {
    const nom = ROLE_PAR_SLUG[produit.slug] ?? produit.titre;
    const partage = nom !== produit.titre ? ` (rôle partagé « ${nom} »)` : '';
    let roleId = parNom.get(nom);

    if (roleId) {
      reutilises += 1;
      console.log(`  = ${produit.titre}${partage} — rôle déjà présent (${roleId})`);
    } else if (!appliquer) {
      console.log(`  + ${produit.titre}${partage} — rôle à créer`);
    } else {
      const creation = await fetch(`${API}/guilds/${guildId}/roles`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
          'X-Audit-Log-Reason': encodeURIComponent(`Catalogue ApexCompany : ${nom}`),
        },
        body: JSON.stringify({ name: nom, permissions: '0', hoist: false, mentionable: false }),
      });

      if (!creation.ok) {
        console.log(
          `  ✗ ${produit.titre} — création refusée (HTTP ${creation.status}) : ${await creation
            .text()
            .catch(() => '')}`,
        );
        continue;
      }

      roleId = ((await creation.json()) as RoleDiscord).id;
      parNom.set(nom, roleId);
      crees += 1;
      console.log(`  + ${produit.titre}${partage} — rôle créé (${roleId})`);
    }

    if (!appliquer || !roleId) continue;

    // Le rôle d'abord, la publication ensuite et seulement si on la demande :
    // la contrainte de la base refuserait l'inverse, et c'est le bon ordre de
    // toute façon — un produit en vente dont le rôle n'existe pas encore
    // encaisserait sans ouvrir d'accès.
    const { error: ecriture } = await supabase
      .from('formations')
      .update({ discord_role_id: roleId, ...(publier ? { actif: true } : {}) })
      .eq('id', produit.id);

    if (ecriture) {
      console.log(`    ✗ écriture en base refusée : ${ecriture.message}`);
      continue;
    }

    if (publier && !produit.actif) publies += 1;
  }

  console.log(
    `\n${produits.length} produit(s) sans rôle — ${crees} rôle(s) créé(s), ` +
      `${reutilises} réutilisé(s)${publier ? `, ${publies} produit(s) publié(s)` : ''}.`,
  );

  if (!appliquer) {
    console.log('\nRien n’a été modifié. Relancer avec --appliquer.');
    return;
  }

  console.log(
    '\nÀ vérifier sur le serveur : **la hiérarchie**. Discord refuse d’attribuer un rôle\n' +
      'situé au-dessus du plus haut rôle du bot, et un rôle neuf se place tout en bas —\n' +
      'donc sous le bot, ce qui est le bon côté. `npm run discord:check` le confirme.',
  );

  if (!publier) {
    console.log(
      'Les produits gardent leur état actuel : ceux en brouillon le restent, et se\n' +
        'publient depuis /admin/formations — ou en relançant avec --publier.',
    );
  }
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
