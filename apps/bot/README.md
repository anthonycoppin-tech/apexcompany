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
   **nommée `Apex`**, onglet **Bot** → _Reset Token_ → copier le jeton (il ne
   s'affiche qu'une fois) → `DISCORD_BOT_TOKEN`.

   Le nom de l'application devient le nom du **rôle** que Discord crée à
   l'invitation — celui qu'on cherche à l'étape 7 pour le hisser en haut de la
   pile, et celui que les membres voient trôner en tête de la liste des rôles.
   Rien dans le code ne s'appuie dessus : le worker ne connaît que le jeton et
   des identifiants numériques, donc un changement d'avis plus tard ne casse
   rien. Garder le même nom sur le serveur de test et sur la production évite
   simplement d'avoir à se le redemander.

2. **Relever l'identifiant et le secret de l'application** — onglet
   _OAuth2_. Les garder sous la main pour l'étape 3 : **ils ne vont dans aucun
   fichier du dépôt**, mais dans le tableau de bord Supabase, qui porte
   l'échange OAuth à notre place.

   Les lignes `DISCORD_CLIENT_ID` et `DISCORD_CLIENT_SECRET` de
   `apps/web/.env.local` ne servent qu'à une instance Supabase **locale**
   (`supabase/config.toml`), laquelle ne tourne pas sur le poste de
   développement, faute de Docker (voir CLAUDE.md). Contre le projet hébergé,
   les laisser vides ne change rien.

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
6. **Créer TOUS les rôles** — `invité`, plus un rôle par produit actif du
   catalogue — et relever leurs identifiants (Paramètres utilisateur → Avancé
   → Mode développeur, puis clic droit sur le rôle → Copier l'ID). Celui
   d'`invité` va dans `DISCORD_ROLE_INVITE_ID` ; ceux des produits se saisissent
   dans `/admin/formations`. Relever au passage l'identifiant du serveur (clic
   droit sur le serveur → Copier l'ID) → `DISCORD_GUILD_ID`.

   **Les créer tous maintenant, pas seulement `invité`** : l'étape suivante
   positionne le bot au-dessus d'eux, et un rôle créé après coup naît au bas de
   la pile — donc sous le bot, ce qui va bien — mais un rôle créé après coup
   **et remonté à la main** repasse facilement au-dessus sans qu'on y pense.

   **Aucune permission à cocher.** Ces rôles ne sont que des étiquettes : ce qui
   décide de ce qu'on voit, ce sont les autorisations **du salon**, réglées
   salon par salon (invisible à `@everyone`, visible au rôle du produit). Un
   rôle produit avec zéro permission serveur fonctionne parfaitement.

7. **Remonter le rôle `Apex`** tout en haut de la liste des rôles du serveur —
   au-dessus de `invité` et de chaque rôle de produit, c'est-à-dire de tout ce
   que le bot doit pouvoir attribuer. C'est une règle Discord, pas un défaut de
   ce code : un rôle placé au-dessus du bot fait échouer chaque attribution en
   403, quoi qu'on écrive ici. **C'est l'erreur qu'on fait à tous les coups la
   première fois.**
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

## L'aller-retour, de bout en bout

Le diagnostic prouve que la chaîne _peut_ fonctionner. Cette épreuve-ci prouve
qu'elle fonctionne : un rôle réellement accordé à quelqu'un, puis réellement
retiré. C'est ce que le projet n'a jamais fait.

### Avant de commencer

Trois conditions, et la troisième est celle qu'on oublie :

1. **Le worker tourne** — `npm run dev:bot` dans un terminal à part. Sans lui,
   les lignes s'empilent dans la file et rien n'arrive sur Discord.
2. **Le site tourne** — `npm run dev`.
3. **Le compte Discord que tu vas lier est déjà membre du serveur de test.**
   Sinon le worker répond `MembreIntrouvable` et **abandonne la ligne
   immédiatement**, sans réessayer : aucun nombre de tentatives ne fait
   rejoindre un serveur à quelqu'un.

Il faut aussi un compte ayant le rôle applicatif `client` : `/espace/communaute`
est derrière cette garde, et les comptes du staff ne l'ont pas. Le seed en
fournit deux — `client.a@apex.test` / `password123`.

### 1. La liaison, et l'attribution

Se connecter, puis aller sur `/espace/communaute` et cliquer « Connecter mon
compte Discord ». Discord demande l'autorisation, puis renvoie sur
`/api/discord/callback`, qui écrit la liaison **et empile le `grant`** du rôle
`invité` — dans cet ordre, parce qu'un rôle empilé avant la liaison n'aurait
aucun identifiant à qui être accordé.

Au retour, l'URL porte `?discord=ok`.

**Ce qu'on doit voir, dans les cinq secondes** (le worker relit la file toutes
les 5 s) : le rôle `invité` apparaît sur le membre, sur le serveur Discord.

Trois traces le confirment, et elles se lisent dans cet ordre quand ça ne
marche pas :

| Où                                    | Ce qu'on doit y trouver                            |
| ------------------------------------- | -------------------------------------------------- |
| Le terminal du worker                 | Aucune erreur                                      |
| `discord_sync_queue`                  | La ligne passée en `reussi`, `traite_at` renseigné |
| `discord_links`                       | `roles_attribues` contient l'identifiant du rôle   |
| Le journal d'audit du serveur Discord | « ApexCompany — synchronisation grant (file …) »   |

`npm run discord:check` résume l'état de la file sans rien modifier : c'est le
plus rapide pour savoir si une ligne est restée en `echoue` ou `abandonne`.

### Où taper le SQL

Dans **l'éditeur SQL du projet Supabase** :
https://supabase.com/dashboard/project/ovlafpgmrwttxstodqxi/sql/new

C'est le même endroit qui servira en production. Coller, « Run », lire le
résultat. Chaque bloc ci-dessous se colle tel quel — les identifiants sont ceux
de la base de dev et du seed.

**Rappel** : cette base est partagée avec l'autre développeur. Les blocs de
remise en état à la fin ne sont pas facultatifs.

### 2. Le retrait

Deux façons, et elles ne prouvent pas la même chose.

**La courte — le worker seul.** Empiler une révocation à la main :

```sql
insert into public.discord_sync_queue (user_id, action, role_id)
values (
  '66666666-6666-6666-6666-666666666666',  -- client.a@apex.test
  'revoke',
  '1548360556388556840'                    -- rôle « invité » du serveur de test
);
```

Le rôle doit disparaître du membre. Ça vérifie le chemin `revoke` du worker, et
rien d'autre.

**La longue — la chaîne métier.** Celle qui compte, parce qu'elle rejoue ce qui
se passera réellement en fin d'accès. `client.a` a déjà une inscription
Accélérateur active : on la fait expirer, et `revoquer_acces_expires()` la
trouve.

D'abord lui donner le rôle du produit, sinon on regarderait disparaître un rôle
qu'il n'a pas :

```sql
-- 1. Le rôle Accélérateur, empilé comme le ferait traiter_paiement().
insert into public.discord_sync_queue (user_id, action, role_id)
values (
  '66666666-6666-6666-6666-666666666666',  -- client.a@apex.test
  'grant',
  '1548360649199849482'                    -- rôle « Accélérateur »
);
```

Le rôle apparaît sur le membre. Puis la révocation :

```sql
-- 2. L'accès expire hier.
update public.inscriptions
set date_fin_acces = current_date - 1
where id = 'e0000000-0000-0000-0000-00000000000a';

-- 3. La révocation. Elle renvoie son compte-rendu en JSON.
select public.revoquer_acces_expires();
```

Attendu : `{"inscriptions_terminees": 1, "roles_revoques": 1, ...}`,
l'inscription passe en `terminee`, une ligne `revoke` entre dans la file, le
worker la consomme, **et le rôle Accélérateur disparaît du membre**.

Remettre en état — la base est partagée, et le seed doit rester reproductible :

```sql
-- 4. L'inscription redevient ce qu'elle était.
update public.inscriptions
set statut = 'active', date_fin_acces = null
where id = 'e0000000-0000-0000-0000-00000000000a';

-- 5. Les lignes de file du test s'en vont. Indispensable avant de basculer
--    DISCORD_GUILD_ID sur la production : ces rôles n'y existent pas.
delete from public.discord_sync_queue;
```

Attendu : l'inscription passe en `terminee`, une ligne `revoke` apparaît dans la
file, le worker la consomme, le rôle disparaît du membre. Et
`automation_logs` reçoit une ligne `revocation.quotidienne` — y compris quand il
n'y a rien à faire, parce qu'un journal vide ne distingue pas « rien à
révoquer » de « plus rien ne s'exécute ».

Le même chemin s'appelle aussi par HTTP, ce qui teste en plus la route que le
planificateur appellera :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/revocation
```

(`CRON_SECRET` est dans `apps/web/.env.local`, à remplir avec n'importe quelle
valeur pour un test local — sans elle la route répond 503.)

### Nettoyer derrière soi

La base de dev est partagée. Supprimer l'inscription de test, et vider les
lignes de file qu'elle a produites — surtout avant de basculer
`DISCORD_GUILD_ID` sur la production, où ces rôles n'existent pas.

### Si le rôle n'arrive pas

Par ordre de fréquence :

- **Ligne en `abandonne` avec « Compte Discord non lié »** : la liaison a
  échoué. Vérifier `discord_links`, et que « Enable Manual Linking » est bien
  activé côté Supabase (étape 4).
- **Ligne en `abandonne` avec « Membre introuvable »** : le compte Discord lié
  n'est pas membre du serveur. Le faire rejoindre, puis réempiler.
- **Ligne en `echoue` avec un 403** : la hiérarchie. Le rôle est passé au-dessus
  d'`Apex`. `npm run discord:check` le dit précisément.
- **Rien ne bouge, ligne en `en_attente`** : le worker ne tourne pas.

## Rôder sur un serveur de test d'abord

Recommandé, et ça ne coûte presque rien : créer un serveur Discord jetable (on
en est propriétaire, donc aucune question de hiérarchie ni de permission sur
soi-même) et y dérouler la mise en service en entier. On se trompe sans témoin,
et sans réordonner les rôles d'une communauté vivante.

**Ce qui ne se refait PAS en passant en production.** L'application Discord
n'appartient à aucun serveur : une seule application sert les deux. Les étapes
1 à 4 — création, jeton, identifiant et secret, réglages Supabase — sont faites
une fois pour toutes. Seules les étapes 5 à 7 se rejouent sur le vrai serveur :
inviter le même bot, recréer les rôles, replacer la hiérarchie.

**Ce qui change, et qu'il faut donc remplacer :**

| Valeur                       | Où                                                 |
| ---------------------------- | -------------------------------------------------- |
| `DISCORD_GUILD_ID`           | `apps/bot/.env` — autre serveur, autre identifiant |
| `DISCORD_ROLE_INVITE_ID`     | `apps/bot/.env` et `apps/web/.env.local`           |
| `formations.discord_role_id` | `/admin/formations`, un par produit                |

**Et une chose à nettoyer avant de basculer** : les lignes de
`discord_sync_queue` laissées par le test désignent des rôles du serveur de
test. Traitées après le changement de `DISCORD_GUILD_ID`, elles échouent en
boucle sur un serveur où ces rôles n'existent pas. Les supprimer, ou les passer
en `abandonne`, avant de démarrer le worker contre la production.

Deux réserves de moindre importance, mais qui surprennent :

- **La base de dev est partagée** avec l'autre développeur
  (`docs/07-REPARTITION.md`). Un test écrit de vraies lignes dans
  `discord_links` et `discord_sync_queue`, et modifie le catalogue.
- **Un compte Discord ne se lie qu'à un seul compte du site.** Le sien servira
  au premier test et restera lié ; pour en refaire un autre, délier d'abord
  (`discord_links`) ou prendre un autre compte Discord.

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
