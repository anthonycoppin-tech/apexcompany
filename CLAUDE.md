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

**Le schéma est passé à la révision 3** (phase 1 bis, sept migrations `20260908*_a_*`) :
`formations`, `formateur`, trois types de produit, propositions, abonnements, colonnes du
formulaire, et l'ancrage RLS du formateur déplacé sur `inscriptions.formateur_id`. Vérifié
par `npm run db:check` et par la suite pgTAP.

**Le scaffold web suit la même arborescence** depuis le 8 septembre 2026 : une page par ligne
de `02-SITEMAP.md`, le groupe `(formateur)` créé avec sa garde, `/qualification` ouverte,
`/offres` devenue `/formations`.

**Le chemin de l'argent est écrit de bout en bout** — formulaire, compte, rendez-vous, fiche
client, proposition, paiement, ouverture de l'accès. Le site public, le back-office et le
reste de l'espace client sont encore des placeholders.

**Rien de tout ça n'a jamais tourné en réel** : ni serveur Discord, ni compte Cal.com, ni clés
Stripe, ni clé serveur Supabase. Typecheck, lint et invariants de base au vert, c'est tout ce
qu'on peut affirmer.

Ce lot appartient normalement au développeur B (`07-REPARTITION.md`) et a été repris pendant
son absence. À signaler avant qu'il ne reprenne son travail : le renommage de routes touche
des fichiers qu'il possède.

## Structure

```
apps/web/src/app/
  (public)/      Site public et tunnel — une page par ligne de 02-SITEMAP.md
  (espace)/      Espace client — garde de layout : rôle client
  (formateur)/   Espace formateur — garde de layout : formateur
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
npm run dev              # Next.js sur :3000
npm run db:check         # Applique migrations + seed sur PGlite et rejoue les invariants RLS
npm run db:push          # Applique les migrations en attente sur le projet hébergé
npm run db:types:linked  # Régénère packages/db/src/database.types.ts depuis le projet hébergé
npm run db:types         # Idem depuis une instance locale — exige Docker, donc CI seulement
npm run typecheck
```

Après **toute** modification du schéma : `npm run db:check`.

`db:types` est la commande de référence mais elle passe par `--local`, donc par Docker :
sur le poste de développement, c'est `db:types:linked` qu'il faut lancer, et seulement
**après** `db:push`, puisqu'elle lit le schéma réellement appliqué sur la base hébergée.
`db:push` écrit sur la **base partagée** : prévenir l'autre développeur avant de la lancer.

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

**Un formateur ne voit que ses affectations, et jamais d'argent.** Ces deux invariants sont
testés dans `supabase/tests/01_rls_formateur.test.sql` et rejoués par `npm run db:check`. Un
test qui casse là signale une fuite de données, pas un test à ajuster. Depuis la révision 3,
l'ancrage est l'affectation explicite — `inscriptions.formateur_id` et `leads.assigned_to` —
et non plus `cohorte_coachs`, ni une dérivation depuis `appointments` : « il a eu un appel
avec cette personne un jour » élargit le périmètre en silence à chaque RDV repris d'un
collègue absent. Seule exception à « jamais d'argent » : `propositions.montant_cents`, que
le formateur émet lui-même et qui est le prix catalogue, public. Ce que le client a
réellement payé lui reste fermé.

**Jamais d'URL de vidéo en base.** Une table de vidéos ne stocke que `provider_asset_id` ;
l'URL signée est émise côté serveur, à durée courte, après revérification de l'inscription.
Règle en sommeil depuis la révision 3 : les replays sont sur Discord, et la table `replays`
a été supprimée. Elle se réveille intacte le jour où une vidéo à accès restreint revient
côté site — ce qui pourrait arriver plus vite que prévu, l'un des deux abonnements envisagés
donnant accès à des « vidéos exclusives » (voir les décisions en attente).

**Les webhooks insèrent d'abord dans `payment_events`.** Dans la même transaction que
le traitement métier. Violation de la contrainte unique = événement déjà traité, on
sort sans rien faire. Stripe et PayPal rejouent : c'est le fonctionnement normal, pas
un cas limite.

« Même transaction » est impossible à tenir depuis le client JavaScript, où chaque appel est
sa propre transaction. C'est pourquoi tout le traitement vit dans **`traiter_paiement()`**
(et `renouveler_abonnement()` pour les mois suivants) : le handler vérifie la signature,
extrait les métadonnées, et fait **un seul** appel. Ajouter une écriture métier côté
TypeScript, après l'appel, rouvrirait exactement la faille — un événement marqué traité et
un client sans accès, sans rien pour le rattraper. Ces deux fonctions sont testées pour
l'idempotence en PGlite **et** en pgTAP.

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
      vérifié sur le projet Supabase hébergé (`ovlafpgmrwttxstodqxi`). Le projet hébergé
      porte encore le schéma de la révision 2 : les migrations de la 1 bis restent à y
      appliquer, et cette base est partagée avec l'autre développeur.
- [~] Scaffold transverse : Next.js, route groups, clients Supabase, gardes de rôle —
  vérifié avec de vraies sessions, et remis à l'arborescence de la révision 3. Chaque page
  reste un placeholder. Les gardes de layout n'ont **pas** été revérifiées avec de vraies
  sessions depuis le resserrage de `/admin` et la création de `(formateur)` : à faire.
- [x] **1 bis — Migrations de la révision 3** : sept migrations `20260908*_a_*` — renommages
      `offres` → `formations` et `coach` → `formateur`, suppression des cohortes / sessions /
      présences / replays / `coaching_sessions` / `payment_schedules`, `type_produit`,
      `modalite`, `duree_acces_jours`, colonnes du formulaire, `propositions`,
      `subscriptions`, et la RLS du formateur réancrée sur l'affectation. Seed, tests pgTAP
      et `scripts/verifier-schema.mjs` refaits avec. **Pas encore poussé sur le projet
      hébergé** — donc `packages/db/src/database.types.ts` est toujours celui de la
      révision 2, et sa régénération demande Docker ou la base hébergée.
- [~] **2 — Tunnel d'entrée** : formulaire natif en cinq écrans, création de compte et session,
  liaison Discord par `linkIdentity` puis `grant` du rôle `invité`, webhook Cal.com. **Écrit,
  jamais exécuté** : ni serveur Discord, ni compte Cal.com, ni clé serveur Supabase.
- [~] **3 — Espace formateur** : tableau de bord, rendez-vous avec issue et compte rendu, liste
  et fiche client, émission de proposition, statistiques. Même réserve — aucune de ces pages
  n'a tourné contre de vraies données.
- [~] **4 — Paiement une fois** : ouverture du paiement depuis la proposition, webhook Stripe,
  et `traiter_paiement()` qui fait tout le reste **en une transaction** — idempotence,
  commande, encaissement, inscription, facture, rôle Discord, proposition, prospect. Son
  idempotence est testée en PGlite et en pgTAP. Manquent les clés Stripe.
- [~] **5 — Abonnement** : renouvellement et résiliation traités par le webhook
  (`renouveler_abonnement()`, résiliation à effet différé), et révocation en fin d'accès par
  `revoquer_acces_expires()`, déclenchée par `api/cron/revocation`. **Reste à écrire** : l'écran
  de résiliation côté client. **Reste à brancher** : un planificateur qui appelle réellement la
  route chaque jour — sans lui, la fonction existe et ne tourne jamais.
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
- **Paiement en plusieurs fois** — **tranché le 8 septembre 2026 : non, tout se paie en une
  fois.** `payment_schedules`, `orders.echelonne` et les deux colonnes d'échelonnement du
  catalogue ont été supprimées (`20260908095000_a_paiement_une_fois.sql`). Si le 3× revient,
  il reviendra par une migration — git garde le fichier pour la retrouver.
- **Les deux abonnements** — **direction donnée, contenu non figé** : un accès communautaire
  premium sur Discord, et un accès à des **vidéos exclusives**. Le schéma les porte déjà sans
  rien ajouter — deux lignes `formations` en `type_produit = 'abonnement'`, chacune avec son
  `discord_role_id`, et un client peut détenir les deux puisque la révocation se raisonne par
  inscription. **La seule question ouverte est l'hébergement des vidéos exclusives.** Si
  elles vivent sur Discord, il n'y a rien à construire. Si elles sont sur le site, la règle
  « jamais d'URL de vidéo en base » se réveille, et avec elle le lecteur à accès restreint que
  la révision 3 avait justement retiré du périmètre — à poser au chef de projet avant la
  phase 5.
- **Vocabulaire** — **tranché** : `formations` et `formateur`. Le schéma dit encore `offres`
  et `coach` ; le renommage est une migration à écrire, et il emporte l'énumération, les
  politiques RLS, les tests pgTAP, le seed et `packages/db`.
- **Calendrier** — **tranché, décision déléguée aux développeurs** : `Cal.com`. Moins cher que
  Calendly à besoin égal, plan gratuit bien plus généreux, `appointments.cal_booking_id` et la
  route `api/cal` restent valables, et l'auto-hébergement reste une porte de sortie.
  **Cal.com ne sert qu'une fois dans le parcours** : l'audit de vente. Les séances qui suivent
  l'achat ne se réservent pas sur le site.
  **Un seul compte, une seule page** — précisé le 8 septembre 2026 : c'est Franck qui prend
  tous les rendez-vous. `/reserver` n'aiguille donc vers personne et il n'y a pas d'écran de
  choix du formateur. **À vérifier à l'inscription** : si les webhooks s'avèrent réservés au
  plan Teams, c'est 12 $/mois pour une personne, pas par formateur. Sans webhook, pas de ligne
  `appointments`, donc pas de tableau de bord formateur.
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
