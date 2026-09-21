# Mise en production — la procédure

Écrit le 18 septembre 2026, avant qu'elle ait eu lieu : **rien de ceci n'a encore été exécuté
contre une production.** C'est la liste de ce que le code attend, relevée dans le dépôt, pour que
le jour J se passe à cocher des cases plutôt qu'à redécouvrir des réglages.

Ce qu'il faut obtenir du client avant de commencer (comptes, clés, domaine, textes juridiques)
est dans [`08-CE-QUI-MANQUE.md`](08-CE-QUI-MANQUE.md). Ce document-ci dit **quoi en faire**.

L'ordre compte : chaque étape suppose les précédentes.

## 1. Le projet Supabase de production

- **Un projet distinct de la base de dev**, sur le plan Pro — un projet gratuit n'a pas de
  sauvegarde quotidienne, ce qui ne se défend pas pour une base qui porte des paiements. Région
  dans l'Union européenne, pour ne pas ouvrir de transfert hors Union dans la politique de
  confidentialité.
- **Les migrations, sans le seed** :

  ```bash
  npx supabase db push --db-url "postgresql://postgres:<mot-de-passe>@db.<ref-prod>.supabase.co:5432/postgres"
  npx supabase migration list --db-url "<la même chaîne>"
  ```

  `--db-url` plutôt que `supabase link` : relier le dépôt à la production, c'est laisser le
  prochain `npm run db:push` d'un développeur écrire dessus en croyant viser la base de dev.
  **Jamais `--include-seed`** : le seed crée des comptes aux mots de passe publics
  (`password123`) et de faux paiements.

- Contrôle : `migration list` doit montrer toutes les migrations du dépôt appliquées, et
  `select count(*) from auth.users` doit valoir 0.

## 2. L'authentification

Dans le tableau de bord du projet de production :

1. **Site URL** = l'adresse réelle du site, en `https://`.
2. **SMTP** (_Authentication → Emails → SMTP Settings_) avec le service d'envoi (Resend) et le
   domaine vérifié. Sans lui, personne ne reçoit d'email de connexion, et **plus aucun paiement
   n'aboutit** (la vérification d'adresse bloque le paiement).
3. **Adresses de retour et modèles d'email**, en une commande, qui lit la Site URL :

   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_... npm run auth:modeles -- <ref-prod>
   ```

   Elle autorise `/connexion/confirmer` **et** `/api/discord/callback` — sans la seconde, la
   liaison Discord aboutit chez Discord mais la route qui empile les rôles n'est jamais
   appelée. Supprimer le jeton juste après : il ouvre tous les projets du compte.

4. **« Enable Manual Linking »** (_Authentication → Providers_). Désactivé par défaut, et sans
   lui aucune liaison Discord ne marche.
5. **Le fournisseur Discord** (_Authentication → Providers → Discord_), avec l'identifiant et
   le secret de l'application Discord ; côté Discord, l'adresse de retour
   `https://<ref-prod>.supabase.co/auth/v1/callback`. Détail dans `apps/bot/README.md`, étapes
   2 à 4.

## 3. Les comptes de l'équipe

**Le premier `owner` ne peut pas se créer depuis le site** : seul un `owner` attribue des rôles.

1. _Authentication → Users → Add user_ : email et mot de passe, « Auto Confirm User » coché.
   Par le tableau de bord et non par un `insert into auth.users` — voir la règle des colonnes
   de jetons dans `CLAUDE.md`.
2. Dans l'éditeur SQL :

   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'owner' from auth.users where email = '<adresse>';

   -- Le déclencheur de création donne `client` à tout nouveau compte. Un compte de
   -- l'équipe n'en veut pas : `/espace` lui serait ouvert, et il compterait parmi les
   -- clients.
   delete from public.user_roles
   where role = 'client' and user_id = (select id from auth.users where email = '<adresse>');
   ```

3. Se connecter sur `/connexion` avec ce compte, et créer les autres comptes de l'équipe par
   _Add user_, leurs rôles se donnant ensuite depuis `/admin/utilisateurs`. Franck reçoit
   `formateur` ; son identifiant va dans `AUDIT_CONSEILLER_USER_ID` (étape 5).

## 4. Discord

Le serveur de production, dans l'ordre de `apps/bot/README.md`, « Mise en service » : inviter
le bot, créer **tous** les rôles (`invité` et un par produit), remonter le rôle `Apex` au-dessus
d'eux, puis `npm run discord:check` avec les variables de production. Corriger au passage le
nom du rôle `Fondation` → `Fondations` (`09-CHANTIERS.md`, observations).

Créer une **invitation permanente** au serveur → `NEXT_PUBLIC_DISCORD_INVITE_URL`.

## 5. Le site sur Vercel

- Plan Pro (le gratuit interdit l'usage commercial, et n'autorise pas une tâche horaire).
- Projet avec **`apps/web` comme répertoire racine** : c'est là que vit `vercel.json`, qui
  déclare les trois tâches planifiées.
- Le domaine, en HTTPS. **`NEXT_PUBLIC_SITE_URL` en `https://` est ce qui ouvre le site aux
  moteurs de recherche** (`lib/site.ts`) : ne pas la renseigner sur une préproduction.
- Les variables d'environnement de production :

| Variable                                                    | D'où elle vient                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Projet de production → _Settings → API_                      |
| `SUPABASE_SERVICE_ROLE_KEY`                                 | Idem. **Jamais préfixée `NEXT_PUBLIC_`**                     |
| `NEXT_PUBLIC_SITE_URL`                                      | Le domaine, en `https://`, sans barre finale                 |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`   | Stripe, clés **live**                                        |
| `STRIPE_WEBHOOK_SECRET`                                     | Le point de terminaison créé à l'étape 7                     |
| `NEXT_PUBLIC_CAL_LIEN`, `CAL_WEBHOOK_SECRET`                | Cal.com (étape 8)                                            |
| `AUDIT_CONSEILLER_USER_ID`                                  | L'identifiant du compte de Franck (étape 3)                  |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`                     | Application Discord, serveur de production                   |
| `DISCORD_ROLE_INVITE_ID`, `NEXT_PUBLIC_DISCORD_INVITE_URL`  | Serveur de production (étape 4)                              |
| `RESEND_API_KEY`, `EMAIL_FROM`                              | Resend, sur le domaine vérifié                               |
| `RESEND_WEBHOOK_SECRET`                                     | Le webhook Resend créé à l'étape 9                           |
| `CRON_SECRET`                                               | Une chaîne aléatoire longue ; Vercel l'envoie à chaque tâche |

Les variables `PAYPAL_*`, `CLOUDFLARE_*` et `VIDEO_PROVIDER` restent vides : PayPal n'est pas
en v1, et les vidéos sont hors projet.

Contrôle : `/admin/parametres` (compte `owner`) dit quels services sont branchés, sans afficher
aucune valeur.

## 6. Le worker Discord

Un processus long, pas une route : il ne tourne pas sur Vercel. Sur un hébergeur de conteneur
(Railway ou équivalent), depuis la racine du dépôt :

```bash
npm ci
npm run build --workspace=@apex/bot
npm run start --workspace=@apex/bot
```

Variables : celles de `apps/bot/.env.example`, avec les valeurs de production.

**La réconciliation des rôles n'est planifiée nulle part** (`npm run discord:reconcile`) : à
brancher sur le même hébergeur, une fois par jour. Sujet de Christopher dans `09-CHANTIERS.md`.

## 7. Stripe

- Point de terminaison `https://<domaine>/api/stripe`, avec **la liste d'événements de
  `08-CE-QUI-MANQUE.md`** : un événement oublié, c'est un litige que le site n'apprendra jamais.
- Enregistrer une fois le **portail client**, avec la mise à jour du moyen de paiement
  autorisée — c'est lui qu'ouvre « Mettre à jour ma carte ».

## 8. Cal.com

Webhook vers `https://<domaine>/api/cal`, avec le secret de `CAL_WEBHOOK_SECRET`, sur la page
de réservation de Franck (création, annulation, report).

## 9. Resend — le domaine, DMARC, le webhook

**Les quatre enregistrements DNS se créent chez le fournisseur du domaine, pas chez Resend.**
Resend affiche les trois premiers (SPF, DKIM, Return-Path) et se contente de vérifier qu'ils
existent. Le quatrième, **DMARC**, il ne le réclame pas : le domaine s'affichera « vérifié »
sans lui, les emails partiront, et ils seront filtrés plus souvent — Gmail et Yahoo l'exigent
depuis 2024, y compris pour du transactionnel. Un `TXT` sur `_dmarc.<domaine>`, en observation
d'abord (`v=DMARC1; p=none; rua=mailto:dmarc@<domaine>`), resserré en `p=quarantine` une fois
les rapports lus. Détail dans [`08-CE-QUI-MANQUE.md`](08-CE-QUI-MANQUE.md).

Puis le webhook, dans _Webhooks → Add Webhook_ : URL `https://<domaine>/api/resend`, événements
`email.delivered`, `email.bounced`, `email.complained`, et le secret affiché (`whsec_...`) dans
`RESEND_WEBHOOK_SECRET`.

Contrôle : `/admin/emails` cesse d'afficher le bandeau « Envoyé ne veut pas dire reçu », et la
tuile « Suivi des réceptions » passe à « Branché ».

## 10. Le catalogue

Saisir les vrais produits dans `/admin/formations`, chacun avec son **rôle Discord de
production** — l'écran refuse de publier un produit sans rôle, et c'est voulu.

## 11. La recette, avant d'annoncer quoi que ce soit

Avec une vraie carte, sur le vrai site, et un compte qui n'est pas de l'équipe :

1. `/?src=ig`, puis « Faire le point » → le formulaire → le prospect apparaît dans le CRM
   **avec la source Instagram**.
2. Email de connexion reçu, en français, avec le code.
3. Liaison Discord → rôle `invité` reçu sur le serveur.
4. Proposition émise depuis `/formateur` → email « proposition reçue » dans l'heure.
5. Paiement → accès dans `/espace`, rôle du produit sur Discord, facture dans
   `/espace/factures`, email « paiement reçu » dans l'heure, ligne dans `/admin/emails`.
6. **Cette ligne passe à « Reçu », pas seulement « Envoyé »** — c'est la preuve que le webhook
   de l'étape 9 est bien branché. Et une adresse volontairement fausse
   (`rien@<domaine>.invalid`) doit ressortir en « Rebond », pas rester en « Envoyé ».
7. Remboursement depuis le back-office → accès fermé, rôle retiré.
8. Le lendemain : les journaux des tâches planifiées dans Vercel, et `/admin/logs`.

Chaque étape qui échoue ici est une étape qui aurait échoué chez un client.
