# ApexCompany — plateforme

Monorepo npm workspaces. Next.js 16 (App Router) + Supabase + TypeScript.
La spécification fonctionnelle fait foi et vit dans [`docs/`](docs/) :
`01-CAHIER-DES-CHARGES.md` (parcours client, rôles, écrans — **à lire en premier**),
`02-SITEMAP.md` (arborescence et matrice d'accès), `04-DATA-MODEL.md` (schéma et RLS),
`06-PERIMETRE.md` (ce qu'on construit et ce qu'on ne construit pas),
`07-REPARTITION.md` (qui possède quoi entre les deux développeurs),
`08-CE-QUI-MANQUE.md` (**tout ce que le code attend de l'extérieur** : clés, informations
juridiques, contenu — à donner au client, pas à un développeur),
`09-CHANTIERS.md` (**qui travaille sur quoi — à lire et à mettre à jour avant de commencer**).

**Avant de coder quoi que ce soit : ouvrir `09-CHANTIERS.md`, prendre un sujet, committer la
prise et la pousser.** Le verrou est Git, pas l'intention : une prise gardée en local ne
protège de rien. Ce fichier remplace le découpage par couche de `07-REPARTITION.md` — personne
n'est limité à un périmètre, on se répartit par sujet.

## ⚠ Une migration attend d'être poussée

`supabase/migrations/20260909120000_a_contenu_editorial.sql` (tables `temoignages` et
`formateurs_fiches`) est écrite, vérifiée, commitée — **et pas encore appliquée sur le projet
hébergé.** Elle a été produite depuis un environnement sans jeton Supabase et sans accès
réseau à `supabase.co`.

**Si tu lis ceci depuis un poste qui atteint la base, c'est la première chose à faire** —
tant qu'elle n'est pas poussée, `packages/db/src/database.types.ts` ignore ces deux tables et
aucun écran ne peut être écrit dessus.

```bash
npm run db:check          # 78 vérifications attendues, 0 échec — avant de toucher la base partagée
npm run db:push
npm run db:types:linked   # c'est CE fichier régénéré qui débloque les écrans
git add packages/db/src/database.types.ts && git commit && git push
```

**N'écris pas une nouvelle migration pour ce changement.** Le fichier existe : il s'applique,
il ne se régénère pas. En rédiger un second pour le même objet donnerait deux migrations
concurrentes sur une base partagée — et une migration ne se modifie jamais après application.

Prévenir l'autre développeur avant de lancer `db:push` : la base est commune. Une fois fait,
retirer ce bloc et passer la ligne correspondante de `09-CHANTIERS.md` en `fait`.

**Les quatre documents sont à la révision 3** (8 septembre 2026) : tunnel inversé, trois
types de produit, disparition des cohortes et des replays, espace formateur dédié.
`01-CAHIER-DES-CHARGES.md` porte le raisonnement, les autres en tirent les conséquences.

## Point d'étape — 8 septembre 2026

Écrit pour que quiconque ouvre une session Claude sur ce dépôt reparte du même état, sans
qu'il faille se le faire raconter. Si tu lis ceci après cette date, vérifie d'abord que c'est
toujours vrai — l'`État d'avancement` plus bas est réputé plus à jour case par case, mais peut
diverger si quelqu'un a codé sans mettre à jour ce fichier.

**Le schéma est à la révision 3, poussé et vérifié sur le projet Supabase hébergé**
(`ovlafpgmrwttxstodqxi`), types régénérés. `npm run db:check` et la suite pgTAP passent : 68
vérifications, 0 échec. Cette base est **partagée entre les deux développeurs** — toujours
prévenir avant `npm run db:push` (`docs/07-REPARTITION.md`).

**Le chemin de l'argent est écrit de bout en bout** : formulaire de qualification → création
de compte et session → liaison Discord → prise de rendez-vous (webhook Cal.com) → fiche
client et émission de proposition côté formateur → paiement Stripe → ouverture de l'accès en
une transaction (`traiter_paiement()`) → renouvellement d'abonnement → révocation automatique
le lendemain de la fin d'accès. Le site public (accueil, catalogue, fiches produit, FAQ,
équipe, contact) est construit et branché sur le vrai catalogue. Le back-office est
**commencé** : garde, navigation, tableau de bord — ses autres écrans (CRM, propositions,
abonnements, transactions, factures, litiges, comptes, logs, audit, paramètres) restent des
placeholders. Détail phase par phase dans `État d'avancement` ci-dessous.

**Rien de tout ça n'a jamais tourné contre les vrais services** : ni serveur Discord, ni
compte Cal.com, ni clés Stripe, ni clé serveur Supabase (`SUPABASE_SERVICE_ROLE_KEY` est vide
dans `.env.local`). Typecheck, lint, `next build` et les invariants de base sont au vert —
c'est tout ce qu'on peut affirmer tant que ces accès manquent. Le client a indiqué les fournir
dans la semaine du 8 septembre.

**Quatre décisions ont été tranchées le 8 septembre, et les quatre sont codées** — détail dans
`01-CAHIER-DES-CHARGES.md` §8 :

- pas de règle d'éligibilité côté Tally : tout prospect qui soumet le formulaire est éligible
  (hors mineurs) — **fait**, `evaluerEligibilite()` renvoie `true` ;
- l'abonnement communauté se vend en self-service, sans passer par l'audit — **fait**,
  `/formations/[slug]/souscrire` ;
- la remise formateur est autorisée sans plafond, Franck décide seul — **fait**, montant
  saisissable et écart avec le catalogue tracé dans `lead_events` ;
- pas de délai de grâce, révocation le lendemain de la fin d'accès — **déjà le comportement
  réel de `revoquer_acces_expires()`, rien à changer**.

**La vérification de l'email bloque désormais le paiement**, comme décidé : non bloquante à
l'inscription et à la prise de rendez-vous, bloquante avant de payer — les deux parcours
d'achat la vérifient. À surveiller de près à la mise en service : **si l'envoi d'emails n'est
pas configuré côté Supabase, plus aucun paiement ne peut aboutir.** C'est le comportement
voulu, mais il faut avoir essayé un vrai parcours d'achat avant d'ouvrir les ventes.

Restent ouverts : l'hébergement des vidéos exclusives d'un des deux abonnements, et le régime
de vente — quelle société vend, et sous quel régime de TVA et de droit de la consommation,
sachant que le vendeur est à Dubaï et les clients dans l'Union (conseil juridique).

**Git est propre** : tout est mergé sur `main`, aucune branche locale ni distante en attente.
Si tu vois des branches `a/*` ou `b/*` qui traînent en local, elles datent d'avant un nettoyage
et peuvent être supprimées sans regret après vérification qu'elles sont bien mergées.

**Un renommage de routes touche le périmètre du développeur B** (`07-REPARTITION.md`) et a été
fait pendant son absence, avec son accord obtenu après coup : `/offres` → `/formations`,
`/coachs` → `/formateurs`, plusieurs routes de la révision 2 supprimées. À avoir en tête avant
de merger du travail commencé sur l'ancienne arborescence.

**Le catalogue de la base hébergée contient encore des données façon révision 2**, migrées
telles quelles : par exemple « Accélérateur » y est un `type_produit = 'formation'` en groupe,
alors que c'est en réalité un accompagnement individuel. Le site affiche donc des données
fausses tant que le catalogue n'a pas été rechargé avec les vrais produits — ce n'est pas un
bug du code, c'est un problème de données à corriger dès qu'elles sont connues.

**Le design system vit dans `apps/web/src/app/globals.css`**, en tokens Tailwind v4. Aucune
page ne pose de couleur littérale : tout passe par `bg-surface`, `text-encre-doux`,
`border-filet`. Une charte est en cours chez un designer — elle se branchera dans ce fichier,
pas dans les pages. Direction retenue en attendant : clair, aéré, contrasté, à l'image de
Mindeo citée en référence ; le noir et doré du site actuel est explicitement écarté.

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
      vérifié sur le projet Supabase hébergé (`ovlafpgmrwttxstodqxi`). Cette base est
      **partagée avec l'autre développeur** — toujours prévenir avant `npm run db:push`.
- [~] Scaffold transverse : Next.js, route groups, clients Supabase, gardes de rôle —
  vérifié avec de vraies sessions, et remis à l'arborescence de la révision 3. Chaque page
  reste un placeholder. Les gardes de layout n'ont **pas** été revérifiées avec de vraies
  sessions depuis le resserrage de `/admin` et la création de `(formateur)` : à faire.
- [x] **1 bis — Migrations de la révision 3** : sept migrations `20260908*_a_*` — renommages
      `offres` → `formations` et `coach` → `formateur`, suppression des cohortes / sessions /
      présences / replays / `coaching_sessions` / `payment_schedules`, `type_produit`,
      `modalite`, `duree_acces_jours`, colonnes du formulaire, `propositions`,
      `subscriptions`, et la RLS du formateur réancrée sur l'affectation. Seed, tests pgTAP
      et `scripts/verifier-schema.mjs` refaits avec. **Poussé sur le projet hébergé et
      `packages/db/src/database.types.ts` régénéré depuis lui** — comme toutes les migrations
      qui ont suivi (paiement, révocation, RLS espace client). Un `npm run db:types:linked`
      après un pull suffit à revérifier que rien n'a divergé.
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
- [x] **6 — Espace client** : accès en cours, rendez-vous, factures et **résiliation de l'abonnement**,
      compte, liaison Discord. La proposition et son paiement y vivent aussi.
- [~] **7 — Site public** : accueil, catalogue et fiches produit branchés sur le vrai catalogue,
  équipe, questions fréquentes, contact. Design system en tokens dans `globals.css`, écrit pour
  être remplacé par la charte du designer sans toucher aux pages. **Le référencement est fait** :
  `sitemap.xml` tire les fiches du catalogue, `robots.txt` **interdit tout tant que le site n'est
  pas servi en HTTPS depuis son vrai domaine** (`lib/site.ts`), `metadataBase` et les balises Open
  Graph sont posées, et les données structurées couvrent l'organisme, les fiches produit et la FAQ
  — sans note moyenne ni raison sociale, faute de témoignages et de société désignée.
  **Restent à faire** : les six pages légales, qui attendent les informations de la société ; les
  témoignages et les biographies des formateurs, qui attendent du contenu client ; l'image Open
  Graph, qui attend la charte du designer.
- [~] **Back-office** : garde admin/owner resserrée, navigation par sections, tableau de bord,
  **CRM prospects** (liste filtrable par étape du pipeline, fiche complète avec affectation et
  statut), **propositions** (avec l'écart au prix catalogue, puisque la remise est libre),
  **abonnements** (triés par urgence : impayés d'abord), **transactions**, **catalogue** et
  **automatisations**. `/admin/audit` est écrit et **pose sa propre garde `owner`** — le layout
  laisse entrer `admin`, la page refuse, et la RLS refuse derrière elle.
  **Factures, remboursements, litiges, comptes et rôles, paramètres** sont écrits eux aussi.
  `/admin/parametres` pose sa garde `owner` comme `/admin/audit`, et montre quels services
  sont réellement branchés — sans jamais afficher la valeur d'une clé.
  **La fiche client** (`/admin/clients` et `/admin/clients/[id]`) rassemble accès, commandes,
  encaissements, factures, abonnements et liaison Discord — cette dernière en tête, parce que
  c'est la première chose à vérifier quand un accès n'arrive pas.
  **Les remboursements s'exécutent** depuis le back-office : demande depuis la fiche client,
  exécution depuis `/admin/paiements/remboursements`. L'appel Stripe passe une clé
  d'idempotence bâtie sur l'identifiant de la ligne — rembourser deux fois est le seul risque
  qui compte ici — et `enregistrer_remboursement()` referme la commande, l'inscription et le
  rôle Discord en une transaction.
  **Reste un placeholder** : `/admin/emails`, qui attend qu'un envoi d'emails existe.
  **L'édition du catalogue est écrite** (`/admin/formations/[id]` et `/nouveau`), avec deux
  garde-fous : la cohérence type de produit / durée d'accès est vérifiée avant la base pour
  donner un message lisible, et **un produit ne peut pas être publié sans rôle Discord** — il
  encaisserait un paiement sans ouvrir d'accès. Un brouillon, si.
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
- **Vocabulaire** — **tranché, et fait** : `formations` et `formateur`. Le renommage a
  emporté l'énumération, les politiques RLS, les tests pgTAP, le seed et `packages/db`
  (`20260908090000_a_renommage_formations_formateur.sql`).
- **Éligibilité du formulaire** — **tranché le 8 septembre 2026 : il n'y a pas de règle côté
  Tally.** Tout prospect qui soumet le formulaire est éligible, à l'exception du refus dur des
  mineurs. Aucune branche « non éligible » à construire dans le tunnel.
  `evaluerEligibilite()` renvoie désormais `true` plutôt que `null` : l'évaluation a eu lieu
  et elle est positive, là où `null` aurait laissé un pipeline entier en attente d'arbitrage.
- **Vente en self-service de l'abonnement communauté** — **tranché le 8 septembre 2026 : oui.**
  Achat direct depuis `/formations/[slug]`, sans passer par l'audit. Entorse assumée au « un
  seul tunnel » de `02-SITEMAP.md`. **Écrit** : `/formations/[slug]/souscrire`.
- **Remise accordée par le formateur** — **tranché le 8 septembre 2026 : oui, sans plafond.**
  Franck dirige l'accompagnement commercial et décide seul du prix qu'il propose. **Écrit** :
  montant saisissable, prix catalogue en valeur par défaut, et écart consigné dans
  `lead_events` — c'est la trace qui remplace le plafond.
- **Délai de grâce en fin d'accès** — **tranché le 8 septembre 2026 : aucun.** La révocation a
  lieu le lendemain de la date de fin d'accès. C'est déjà le comportement de
  `revoquer_acces_expires()`, qui sélectionne `date_fin_acces < current_date` : rien à changer.
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
