# ApexCompany — plateforme

Monorepo npm workspaces. Next.js 16 (App Router) + Supabase + TypeScript.
La spécification fonctionnelle fait foi et vit dans [`docs/`](docs/) :
`02-SITEMAP.md` (arborescence et matrice d'accès), `04-DATA-MODEL.md` (schéma et RLS),
`06-PERIMETRE.md` (ce qu'on construit et ce qu'on ne construit pas),
`07-REPARTITION.md` (qui possède quoi entre les deux développeurs).

## Structure

```
apps/web/src/app/
  (public)/      Site public et tunnel — une page par ligne de 02-SITEMAP.md
  (espace)/      Espace client — garde de layout : rôle client
  (admin)/       Back-office — garde de layout : coach, admin, owner
  api/           Webhooks (stripe, paypal, cal, discord)
apps/web/src/lib/
  supabase/      client.ts (navigateur), server.ts (serveur, RLS),
                 service-role.ts (contourne la RLS, server-only), proxy.ts
  auth/          roles.ts — lecture des rôles, gardes de layout
apps/bot         Worker Discord — consomme discord_sync_queue
packages/db      Types générés depuis le schéma, partagés web ↔ bot
supabase/        migrations/, seed.sql, tests/ (pgTAP)
docs/            Spécification
```

## Commandes

```bash
npm run dev            # Next.js sur :3000
npm run db:check       # Applique migrations + seed sur PGlite et rejoue les invariants RLS
npm run db:types       # Régénère packages/db/src/database.types.ts
npm run typecheck
```

Après **toute** modification du schéma : `npm run db:check`.

## Docker n'est pas disponible en local

Le poste de développement est derrière un proxy d'entreprise qui bloque Docker
Desktop, et le compte n'a pas les droits administrateur pour installer WSL. `supabase
start`, `supabase db reset` et `supabase test db` **ne tournent pas en local** — les
scripts existent (`db:start`, `db:reset`, `db:test`) mais ne servent qu'en CI.

En remplacement, `npm run db:check` applique les migrations et le seed sur un
PostgreSQL réel compilé en WebAssembly (PGlite), puis rejoue les invariants de
cloisonnement. C'est la boucle de vérification de tous les jours.

Ce qu'il ne couvre pas : GoTrue, PostgREST, le Storage, les extensions Supabase. La
suite pgTAP de `supabase/tests/` reste la référence et tourne en CI, où Docker est
disponible. Toute règle vérifiée dans `scripts/verifier-schema.mjs` doit donc **aussi**
exister en pgTAP, et réciproquement : les deux se maintiennent ensemble.

Conséquence pratique : le développement applicatif se fait contre un **projet
Supabase hébergé** (un projet gratuit sert de base de dev partagée), pas contre une
instance locale.

Cette base est **partagée entre les deux développeurs**, et rien ne les isole l'un de
l'autre : une migration appliquée par l'un change l'application de l'autre sans qu'aucun
fichier ait bougé, et une donnée saisie à la main avec un compte du seed rend le seed non
reproductible. Le problème est ouvert — mitigations du quotidien et solution envisagée
(le branching du plan Pro) dans `docs/07-REPARTITION.md`.

## Ce qu'il ne faut pas casser

Ces règles ne sont pas des préférences de style. Chacune correspond à un incident
identifié en conception ; les contourner « juste pour ce cas » est la façon dont
elles cèdent.

**La RLS est la sécurité, pas le filtre d'affichage.** Un `where user_id = ...`
dans une requête est du confort. La garantie est dans la politique. Toute nouvelle
table : `enable row level security` dans la même migration que le `create table`,
et une politique explicite — ou une absence de politique assumée et commentée.

**Un coach ne voit que ses cohortes, et jamais d'argent.** Ces deux invariants sont
testés dans `supabase/tests/01_rls_coach.test.sql`. Un test qui casse là signale une
fuite de données, pas un test à ajuster.

**Jamais d'URL de vidéo en base.** `replays` ne stocke que `provider_asset_id`. L'URL
signée est émise côté serveur, à durée courte, après revérification de l'inscription.

**Les webhooks insèrent d'abord dans `payment_events`.** Dans la même transaction que
le traitement métier. Violation de la contrainte unique = événement déjà traité, on
sort sans rien faire. Stripe et PayPal rejouent : c'est le fonctionnement normal, pas
un cas limite.

**Discord passe par la file.** On écrit dans `discord_sync_queue`, jamais d'appel
direct à l'API Discord depuis un handler de paiement. Une coupure Discord ne doit pas
faire perdre un accès client silencieusement.

**`SUPABASE_SERVICE_ROLE_KEY` contourne la RLS.** Serveur uniquement. Jamais dans un
composant client, jamais dans une variable préfixée `NEXT_PUBLIC_`.

**L'argent est en centimes, en entier.** Jamais de flottant.

**Les rôles vivent dans `user_roles`.** Jamais dans `profiles`, jamais dans les
métadonnées du JWT : une colonne de rôle éditable par le porteur du compte est une
élévation de privilège offerte.

**Un `insert into auth.users` doit remplir les colonnes de jetons en chaîne vide,
jamais NULL.** `confirmation_token`, `recovery_token`, `email_change`,
`email_change_token_new`, `email_change_token_current`, `phone_change`,
`phone_change_token`, `reauthentication_token`. GoTrue les scanne dans des champs Go
non nullables ; une seule NULL et la connexion répond 500 « Database error querying
schema », sans rien dans les politiques RLS pour l'expliquer. Cassé une fois en
silence sur le projet hébergé — ni pgTAP ni PGlite ne l'auraient vu, aucun des deux
ne fait un vrai `/auth/v1/token`. C'est pour ça que la CI fait maintenant un login
réel (`.github/workflows/ci.yml`, job _database_) en plus des tests RLS.

## Conventions

- Schéma, colonnes, valeurs d'énumération : **en français**, comme la spécification.
  Le code TypeScript est en anglais sauf pour les noms issus du domaine.
- Migrations : `AAAAMMJJHHMMSS_domaine.sql`, jamais modifiées après application.
  Une correction est une nouvelle migration.
- Commentaires : expliquer _pourquoi_, le _quoi_ se lit dans le code.

## État d'avancement

Phases de `docs/06-PERIMETRE.md` :

- [x] **1 — Fondations** : schéma, RLS, seed multi-rôles, tests pgTAP, poussé et
      vérifié sur le projet Supabase hébergé (`ovlafpgmrwttxstodqxi`)
- [~] Scaffold transverse : Next.js, route groups des 40 pages, clients Supabase,
  gardes de rôle — vérifié avec de vraies sessions. Chaque page reste un
  placeholder ; le contenu réel appartient aux phases ci-dessous.
- [ ] 2 — Back-office : CRM, fiches clients, rôles, logs
- [ ] 3 — Paiement : abstraction, Stripe, PayPal, factures, remboursements
- [~] 4 — Discord : worker écrit (apps/bot), suit `discord_sync_queue` au plus
  près du schéma — **jamais testé en réel**, aucune application Discord
  n'existe encore. Voir apps/bot/README.md pour ce qu'il faut créer. Depuis la
  décision sur les calls de groupe (`docs/06-PERIMETRE.md`), cette phase bloque
  aussi la tenue des cours eux-mêmes, pas seulement la synchronisation des rôles.
- [ ] 5 — Sessions et replays : planning, présences, lecteur sécurisé
- [ ] 6 — Site public et tunnel
- [ ] 7 — Migration des données, recette, mise en production

## Décisions en attente du client

- **Hébergeur des replays** — non tranché. Cloudflare Stream ou Bunny recommandés ;
  le critère est le contrôle d'accès par URL signée, pas le prix. Dépend du volume
  d'heures enregistrées par mois, information à demander.
- **Plan Supabase Pro** — non tranché, et c'est une dépense : 25 $/mois par
  organisation. Ce qu'on achète réellement, c'est le **branching** (une base éphémère par
  pull request), qui supprime les conflits sur la base de dev partagée, et la fin de la
  mise en veille des projets gratuits après une semaine d'inactivité. Argumentaire dans
  `docs/07-REPARTITION.md`.
- **Messagerie coach ↔ client** — recommandation : hors v1, l'échange reste sur
  Discord. Voir l'argumentaire dans `docs/06-PERIMETRE.md`.
