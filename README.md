# ApexCompany — plateforme

CRM, tunnel de vente, espace client et back-office pour un organisme de formation
dont les cours sont dispensés en direct sur Discord.

La spécification vit dans [`docs/`](docs/). Les conventions et les règles à ne pas
casser sont dans [`CLAUDE.md`](CLAUDE.md). La répartition du travail entre les deux
développeurs est dans [`docs/07-REPARTITION.md`](docs/07-REPARTITION.md) — **à lire
avant le premier commit.**

## Démarrer

```bash
npm install
cp .env.example .env.local     # puis renseigner les clés Supabase
npm run db:check               # vérifie migrations + seed + politiques RLS
npm run dev
```

## Base de données

`supabase/migrations/` contient le schéma, `supabase/seed.sql` un jeu de données avec
un utilisateur par rôle et deux formateurs aux affectations distinctes — c'est ce qui
permet de vérifier qu'aucun ne voit les clients de l'autre.

```bash
npm run db:check    # migrations + seed + invariants RLS, sans Docker
npm run db:types    # régénère les types TypeScript depuis le schéma
```

> **Docker est bloqué sur les postes de développement** (proxy dentreprise, pas de
> droits administrateur pour installer WSL). `npm run db:check` applique tout sur un
> PostgreSQL compilé en WebAssembly et rejoue les règles de cloisonnement ; la suite
> pgTAP complète tourne en CI. Détails dans [`CLAUDE.md`](CLAUDE.md).

Comptes du jeu de données — mot de passe `password123` :

| Rôle        | Email                   |
| ----------- | ----------------------- |
| owner       | `owner@apex.test`       |
| admin       | `admin@apex.test`       |
| formateur A | `formateur.a@apex.test` |
| formateur B | `formateur.b@apex.test` |
| branding    | `branding@apex.test`    |
| client A    | `client.a@apex.test`    |
| client B    | `client.b@apex.test`    |

## Structure

```
apps/web        Next.js 16 — site public, espace client, back-office, webhooks
apps/bot        Worker Discord — consomme discord_sync_queue
packages/db     Types générés depuis le schéma, partagés web ↔ bot
supabase/       migrations/, seed.sql, tests/ (pgTAP)
scripts/        Vérification du schéma hors Docker
docs/           Spécification et répartition du travail
```

## Avancement

Phase 1 (fondations) faite : schéma complet, politiques RLS, seed multi-rôles,
36 vérifications de cloisonnement, CI — en ligne et vérifié sur le projet Supabase
hébergé, y compris un login réel par rôle.

Scaffold Next.js posé : les 40 pages de `docs/02-SITEMAP.md`, clients Supabase
(navigateur, serveur, service_role), gardes d'accès par rôle sur `(espace)` et
`(admin)` — testées avec de vraies sessions formateur et client.

Les phases 2 à 7 sont détaillées dans [`docs/06-PERIMETRE.md`](docs/06-PERIMETRE.md).
