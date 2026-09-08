# ApexCompany — plateforme

Monorepo npm workspaces. Next.js 16 (App Router) + Supabase + TypeScript.
La spécification fonctionnelle fait foi et vit dans [`docs/`](docs/) :
`01-CAHIER-DES-CHARGES.md` (parcours client, rôles, écrans — **à lire en premier**),
`02-SITEMAP.md` (arborescence et matrice d'accès), `04-DATA-MODEL.md` (schéma et RLS),
`06-PERIMETRE.md` (ce qu'on construit et ce qu'on ne construit pas),
`07-REPARTITION.md` (qui possède quoi entre les deux développeurs).

**Les quatre documents sont à la révision 3** (8 septembre 2026) : tunnel inversé, trois
types de produit, disparition des cohortes et des replays, espace formateur dédié.
`01-CAHIER-DES-CHARGES.md` porte le raisonnement, les autres en tirent les conséquences.

**Le code et le schéma, eux, sont restés à la révision 2.** Les migrations de
`supabase/migrations/` décrivent encore des cohortes, `app_role` dit encore `coach`, et les
40 pages du scaffold suivent l'ancienne arborescence. Les écarts sont signalés par ⚠️ **à
écrire** dans `04-DATA-MODEL.md`. Tant qu'ils ne sont pas comblés, **la base ne décrit plus
le produit** : lire les docs avant de se fier au schéma, pas l'inverse.

## Structure

```
apps/web/src/app/
  (public)/      Site public et tunnel — une page par ligne de 02-SITEMAP.md
  (espace)/      Espace client — garde de layout : rôle client
  (formateur)/   Espace formateur — garde de layout : formateur    ⚠️ à créer (rév. 3)
  (admin)/       Back-office — garde de layout : admin, owner
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
fuite de données, pas un test à ajuster. La révision 3 supprime les cohortes : le premier
invariant devient « ses **affectations** » et change d'ancrage — `inscriptions.formateur_id`
et `leads.assigned_to` au lieu de `cohorte_coachs`. L'invariant lui-même ne s'assouplit
pas ; c'est la migration la plus délicate du chantier (voir `01-CAHIER-DES-CHARGES.md` §5).

**Jamais d'URL de vidéo en base.** `replays` ne stocke que `provider_asset_id`. L'URL
signée est émise côté serveur, à durée courte, après revérification de l'inscription.
Règle en sommeil depuis la révision 3 : les replays sont sur Discord et la table part.
Elle se réveille intacte le jour où une vidéo à accès restreint revient côté site.

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

Phases de `docs/06-PERIMETRE.md`, réordonnées en révision 3 sur le chemin de l'argent.

- [x] **1 — Fondations** : schéma, RLS, seed multi-rôles, tests pgTAP, poussé et
      vérifié sur le projet Supabase hébergé (`ovlafpgmrwttxstodqxi`) — **au schéma de la
      révision 2**, donc à reprendre en 1 bis.
- [~] Scaffold transverse : Next.js, route groups, clients Supabase, gardes de rôle —
  vérifié avec de vraies sessions. Chaque page reste un placeholder, et l'arborescence
  est celle de la révision 2 : `/espace/replays`, `/espace/planning` et `/admin/cohortes`
  n'ont plus lieu d'être, `/formateur` et `/qualification` manquent.
- [ ] **1 bis — Migrations de la révision 3** : renommages `offres` → `formations` et
      `coach` → `formateur`, suppression des cohortes / sessions / présences / replays,
      colonnes du formulaire, `modalite`, `propositions`, `subscriptions`. Emporte les
      politiques RLS et les tests pgTAP du rôle formateur. **C'est le préalable à tout le
      reste.**
- [ ] 2 — Tunnel d'entrée : formulaire natif, création de compte, Discord `invité`, Cal.com
- [ ] 3 — Espace formateur : tableau de bord, RDV, fiches, propositions, statistiques
- [ ] 4 — Paiement une fois : Stripe, facture, inscription, rôle Discord
- [ ] 5 — Abonnement : renouvellement, échec de prélèvement, résiliation, révocation
- [ ] 6 — Espace client
- [ ] 7 — Site public : contenu marketing, SEO, pages légales
- [ ] 8 — Événements, migration des données, recette, mise en production
- [~] **Transverse — Discord** : worker écrit (apps/bot), suit `discord_sync_queue` au plus
  près du schéma — **jamais testé en réel**, aucune application Discord n'existe encore.
  Voir apps/bot/README.md. Devient bloquant dès la phase 2, et depuis la décision sur les
  calls de groupe (`docs/06-PERIMETRE.md`), il porte aussi la tenue des cours eux-mêmes,
  pas seulement la synchronisation des rôles.

## Décisions en attente du client

- **Hébergeur des replays** — **tranché, sans objet** : les replays vivent sur Discord.
  Le site n'héberge que de la vidéo marketing, publique par nature, donc sans contrôle
  d'accès à construire.
- **Modèle économique** — **tranché** : trois types de produit. Abonnement mensuel récurrent
  (communauté), accompagnement acheté en une fois pour 1, 3 ou 6 mois, et formation achetée
  en une fois à accès illimité. Une seule mécanique d'accès couvre les trois —
  `inscriptions.date_fin_acces`, avec `null` pour illimité (`01-CAHIER-DES-CHARGES.md` §1).
  La couche paiement, elle, porte bien deux mécaniques : abonnement Stripe et paiement unique.
- **Vocabulaire** — **tranché** : `formations` et `formateur`. Le schéma dit encore `offres`
  et `coach` ; le renommage est une migration à écrire, et il emporte l'énumération, les
  politiques RLS, les tests pgTAP, le seed et `packages/db`.
- **Calendrier** — **tranché, décision déléguée aux développeurs** : `Cal.com`. Une page de
  réservation individuelle par formateur, `/reserver` faisant l'aiguillage — donc aucune
  fonctionnalité d'équipe à payer. Moins cher que Calendly à besoin égal, plan gratuit bien
  plus généreux, `appointments.cal_booking_id` et la route `api/cal` restent valables, et
  l'auto-hébergement reste une porte de sortie. **À vérifier à l'inscription** : si les
  webhooks s'avèrent réservés au plan Teams, c'est 12 $/utilisateur/mois — sans webhook, pas
  de ligne `appointments`, donc pas de tableau de bord formateur. **Cal.com ne sert qu'une
  fois dans le parcours** : l'audit de vente. Les séances qui suivent l'achat ne se réservent
  pas sur le site.
- **Individuel ou groupe** — **tranché** : porté par `formations.modalite`, un axe distinct de
  `type_produit` (qui dit comment on paie, pas comment le cours se donne). C'est une colonne
  d'information — fiche produit et back-office. L'accès ne change pas, et **la planification
  reste hors plateforme** : les formateurs organisent les séances individuelles avec leur
  client, le planning de groupe s'annonce sur Discord (`01-CAHIER-DES-CHARGES.md` §3, étape
  4 bis). Pas de table `seances` : la suppression de `coaching_sessions` est confirmée.
- **Plan Supabase Pro** — non tranché, et c'est une dépense : 25 $/mois par
  organisation. Ce qu'on achète réellement, c'est le **branching** (une base éphémère par
  pull request), qui supprime les conflits sur la base de dev partagée, et la fin de la
  mise en veille des projets gratuits après une semaine d'inactivité. Argumentaire dans
  `docs/07-REPARTITION.md`.
- **Messagerie coach ↔ client** — recommandation : hors v1, l'échange reste sur
  Discord. Voir l'argumentaire dans `docs/06-PERIMETRE.md`.
