# @apex/bot

Worker qui consomme `discord_sync_queue` : accorde ou retire un rôle Discord
en fonction des inscriptions et paiements, sans jamais appeler l'API Discord
directement depuis le site (voir CLAUDE.md, « Discord passe par la file »).

Pas de connexion au Gateway Discord, pas de `discord.js` : deux appels REST
suffisent (`PUT`/`DELETE` sur `/guilds/{id}/members/{id}/roles/{id}`). La
liaison de compte (qui remplit `discord_links`) se fait côté web via l'OAuth
Discord de Supabase Auth — le rôle de ce worker s'arrête à la synchronisation
des rôles.

## Non testé en conditions réelles

Contrairement au reste du dépôt, cette partie n'a pas encore été vérifiée
contre un vrai serveur Discord. La logique suit le schéma au plus près et
passe le typecheck, mais rien n'a jamais attribué un rôle à quelqu'un.

## Mise en service — dans cet ordre

Les étapes 1 à 7 se font entièrement depuis un navigateur et l'application
Discord : aucune n'a besoin du dépôt. La 8 seule demande un poste de
développement.

Deux d'entre elles sont des pièges silencieux, et ce sont les deux qui coûtent
une soirée : l'étape 4 (« Enable Manual Linking », sans quoi la liaison de
compte échoue) et l'étape 7 (la hiérarchie des rôles, sans quoi chaque
attribution échoue en 403).

1. **Créer l'application** sur https://discord.com/developers/applications,
   onglet **Bot** → _Reset Token_ → copier le jeton (il ne s'affiche qu'une
   fois) → `DISCORD_BOT_TOKEN`.
2. **Relever l'identifiant et le secret de l'application** — onglet
   _OAuth2_ → `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`. Ils servent au
   site, pas au worker : c'est par eux que le client lie son compte.
3. **Déclarer l'URL de retour** dans _OAuth2_ → _Redirects_ :
   `https://ovlafpgmrwttxstodqxi.supabase.co/auth/v1/callback`, puis
   **activer le fournisseur Discord côté Supabase** (Authentication →
   Providers → Discord) avec ces mêmes identifiant et secret. Sans ces deux
   réglages, le bouton « Connecter mon compte Discord » ne mène nulle part.
4. **Activer « Enable Manual Linking »** dans les réglages d'authentification
   du projet Supabase (Authentication → Providers). Ce n'est pas une option
   décorative : `linkIdentity()` — la seule façon dont le site obtient un
   `discord_user_id` — **échoue tant qu'elle est désactivée**, et elle l'est
   par défaut. C'est `@supabase/auth-js` qui l'impose, pas notre code
   (`components/bouton-lier-discord.tsx`).

   Deux conséquences à connaître avant de tester : il faut **être connecté**
   pour appeler `linkIdentity()`, et **un même compte Discord ne peut être
   lié qu'à un seul compte du site**. Tester deux fois avec son propre Discord
   sur deux comptes différents échoue au second — délier le premier, ou
   prendre un autre compte Discord.

5. **Inviter le bot** — _OAuth2_ → _URL Generator_, scope `bot`, permission
   `Manage Roles`. Ouvrir l'URL générée, choisir le serveur.
6. **Créer le rôle `invité`** sur le serveur, et relever son identifiant
   (Paramètres utilisateur → Avancé → Mode développeur, puis clic droit sur
   le rôle → Copier l'ID) → `DISCORD_ROLE_INVITE_ID`. Relever au passage
   l'identifiant du serveur (clic droit sur le serveur → Copier l'ID) →
   `DISCORD_GUILD_ID`.
7. **Remonter le rôle du bot** au-dessus, dans la liste des rôles du serveur,
   de tous ceux qu'il doit attribuer — le rôle `invité` et un rôle par
   produit. C'est une règle Discord, pas un défaut de ce code : un rôle placé
   au-dessus du bot fait échouer chaque attribution en 403, quoi qu'on écrive
   ici. **C'est l'erreur qu'on fait à tous les coups la première fois.**
8. **Vérifier avant de démarrer quoi que ce soit** :

   ```bash
   npm run discord:check
   ```

   Le diagnostic ne modifie rien. Il relit le jeton, la présence du bot sur le
   serveur, sa permission, puis **la position de chaque rôle qu'il devra
   attribuer** — celui de `invité` et celui de chaque produit du catalogue —,
   et termine par l'état de la file. Chaque échec est accompagné du geste qui
   le corrige. Le lancer avant le worker évite de remplir la file d'échecs
   qu'il faudrait ensuite reprendre à la main.

Les variables du worker vivent dans `apps/bot/.env` (copier `.env.example`),
celles du site dans `apps/web/.env.local`. `DISCORD_ROLE_INVITE_ID` est lue
par le site, et répétée dans `.env` du bot pour que le diagnostic puisse la
vérifier.

## Développement

```bash
npm run discord:check          # diagnostic, lecture seule
npm run dev --workspace=@apex/bot
```

## Ce qui manque encore

- **Le test réel** : attribution et retrait d'un rôle sur un vrai compte, de
  bout en bout. C'est ce que la mise en service ci-dessus permet enfin.
- **Un rôle Discord par produit actif du catalogue.** Au 12 septembre 2026, la
  base hébergée porte encore les données de la révision 2 : « Fondations » est
  actif sans aucun rôle, et « Accélérateur » porte un identifiant de seed
  (`900000000000000001`) qui n'existe sur aucun serveur. Les deux se corrigent
  depuis `/admin/formations`, et `npm run discord:check` les signale.
- **Deux salons par produit**, visibles uniquement du rôle du produit
  (`formations.discord_role_id`) : un **salon vocal** où se tiennent les calls,
  qui remplace le lien Zoom, et un **salon texte** où l'équipe publie le
  planning hebdomadaire des séances de groupe. Voir docs/06-PERIMETRE.md, « La
  visioconférence » et « La planification des séances ». À créer à la main : le
  worker ne gère que les rôles, pas les salons. Si la création devient
  répétitive à chaque nouveau produit, c'est un `POST /guilds/{id}/channels` à
  ajouter ici — pas avant.
- **Où le worker tourne en production.** C'est un processus long, pas une route
  HTTP : il ne peut pas vivre sur le même hébergement que le site s'il est
  serverless. Même question ouverte que le planificateur de
  `revoquer_acces_expires()` (docs/09-CHANTIERS.md).
- **Décider quoi faire d'un `MembreIntrouvable` répété** : relancer une invite,
  ou juste laisser l'alerte dans `admin/logs` pour une action manuelle. Non
  tranché dans docs/06-PERIMETRE.md.
- Si le worker tourne un jour en plusieurs instances : remplacer la
  réclamation en deux étapes de `reclamerLot()` (src/worker.ts) par une
  fonction RPC `SELECT ... FOR UPDATE SKIP LOCKED` côté Postgres, qui seule
  garantit qu'une ligne n'est prise que par un worker à la fois.

## Ce qui est déjà fait, et qu'il ne faut pas refaire

L'insertion dans `discord_sync_queue` est en place aux trois endroits qui
comptent, et toujours côté SQL, dans la même transaction que le reste :
`traiter_paiement()`, `revoquer_acces_expires()` et
`enregistrer_remboursement()`. Rien à ajouter côté TypeScript — une écriture
métier après l'appel rouvrirait exactement la faille que ces fonctions
referment (voir CLAUDE.md).
