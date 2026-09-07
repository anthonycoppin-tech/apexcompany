# ApexCompany — plateforme

Monorepo npm workspaces. Next.js 15 (App Router) + Supabase + TypeScript.
La spécification fonctionnelle fait foi et vit dans [`docs/`](docs/) :
`02-SITEMAP.md` (arborescence et matrice daccès), `04-DATA-MODEL.md` (schéma et RLS),
`06-PERIMETRE.md` (ce quon construit et ce quon ne construit pas).

## Structure

```
apps/web        Next.js — site public, espace client, back-office, webhooks
apps/bot        Worker Discord — consomme discord_sync_queue
packages/db     Types générés depuis le schéma, partagés web ↔ bot
supabase/       migrations/, seed.sql, tests/ (pgTAP)
docs/           Spécification
```

## Commandes

```bash
npm run dev            # Next.js sur :3000
npm run db:check       # Applique migrations + seed sur PGlite et rejoue les invariants RLS
npm run db:types       # Régénère packages/db/src/database.types.ts
npm run typecheck
```

Après **toute** modification du schéma : `npm run db:check`.

## Docker nest pas disponible en local

Le poste de développement est derrière un proxy dentreprise qui bloque Docker
Desktop, et le compte na pas les droits administrateur pour installer WSL. `supabase
start`, `supabase db reset` et `supabase test db` **ne tournent pas en local** — les
scripts existent (`db:start`, `db:reset`, `db:test`) mais ne servent quen CI.

En remplacement, `npm run db:check` applique les migrations et le seed sur un
PostgreSQL réel compilé en WebAssembly (PGlite), puis rejoue les invariants de
cloisonnement. Cest la boucle de vérification de tous les jours.

Ce quil ne couvre pas : GoTrue, PostgREST, le Storage, les extensions Supabase. La
suite pgTAP de `supabase/tests/` reste la référence et tourne en CI, où Docker est
disponible. Toute règle vérifiée dans `scripts/verifier-schema.mjs` doit donc **aussi**
exister en pgTAP, et réciproquement : les deux se maintiennent ensemble.

Conséquence pratique : le développement applicatif se fait contre un **projet
Supabase hébergé** (un projet gratuit sert de base de dev partagée), pas contre une
instance locale.

## Ce quil ne faut pas casser

Ces règles ne sont pas des préférences de style. Chacune correspond à un incident
identifié en conception ; les contourner « juste pour ce cas » est la façon dont
elles cèdent.

**La RLS est la sécurité, pas le filtre daffichage.** Un `where user_id = ...`
dans une requête est du confort. La garantie est dans la politique. Toute nouvelle
table : `enable row level security` dans la même migration que le `create table`,
et une politique explicite — ou une absence de politique assumée et commentée.

**Un coach ne voit que ses cohortes, et jamais dargent.** Ces deux invariants sont
testés dans `supabase/tests/01_rls_coach.test.sql`. Un test qui casse là signale une
fuite de données, pas un test à ajuster.

**Jamais dURL de vidéo en base.** `replays` ne stocke que `provider_asset_id`. LURL
signée est émise côté serveur, à durée courte, après revérification de linscription.

**Les webhooks insèrent dabord dans `payment_events`.** Dans la même transaction que
le traitement métier. Violation de la contrainte unique = événement déjà traité, on
sort sans rien faire. Stripe et PayPal rejouent : cest le fonctionnement normal, pas
un cas limite.

**Discord passe par la file.** On écrit dans `discord_sync_queue`, jamais dappel
direct à lAPI Discord depuis un handler de paiement. Une coupure Discord ne doit pas
faire perdre un accès client silencieusement.

**`SUPABASE_SERVICE_ROLE_KEY` contourne la RLS.** Serveur uniquement. Jamais dans un
composant client, jamais dans une variable préfixée `NEXT_PUBLIC_`.

**Largent est en centimes, en entier.** Jamais de flottant.

**Les rôles vivent dans `user_roles`.** Jamais dans `profiles`, jamais dans les
métadonnées du JWT : une colonne de rôle éditable par le porteur du compte est une
élévation de privilège offerte.

## Conventions

- Schéma, colonnes, valeurs dénumération : **en français**, comme la spécification.
  Le code TypeScript est en anglais sauf pour les noms issus du domaine.
- Migrations : `AAAAMMJJHHMMSS_domaine.sql`, jamais modifiées après application.
  Une correction est une nouvelle migration.
- Commentaires : expliquer *pourquoi*, le *quoi* se lit dans le code.

## État davancement

Phases de `docs/06-PERIMETRE.md` :

- [x] **1 — Fondations** : schéma, RLS, seed multi-rôles, tests pgTAP
- [ ] 2 — Back-office : CRM, fiches clients, rôles, logs
- [ ] 3 — Paiement : abstraction, Stripe, PayPal, factures, remboursements
- [ ] 4 — Discord : bot, liaison de compte, synchronisation
- [ ] 5 — Sessions et replays : planning, présences, lecteur sécurisé
- [ ] 6 — Site public et tunnel
- [ ] 7 — Migration des données, recette, mise en production

## Décisions en attente du client

- **Hébergeur des replays** — non tranché. Cloudflare Stream ou Bunny recommandés ;
  le critère est le contrôle daccès par URL signée, pas le prix. Dépend du volume
  dheures enregistrées par mois, information à demander.
- **Messagerie coach ↔ client** — recommandation : hors v1, léchange reste sur
  Discord. Voir largumentaire dans `docs/06-PERIMETRE.md`.
