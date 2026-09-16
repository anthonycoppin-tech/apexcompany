# Chantiers — qui travaille sur quoi

Ce fichier existe pour une seule raison : **empêcher que deux personnes fassent le même
travail sans le savoir.** Il remplace le découpage par couche de
[`07-REPARTITION.md`](07-REPARTITION.md), qui supposait deux développeurs à charge égale et
des périmètres étanches — ce n'est pas ce qui se passe. Personne n'est limité à une couche :
on prend un sujet, on le dit ici, on avance.

Ce qui reste valable dans `07-REPARTITION.md` : les trois fichiers qui posent réellement
problème (migrations, `database.types.ts`, `package-lock.json`), et le conflit sur la base de
dev partagée. Ça n'a pas changé.

## À faire avant de coder — état de la base partagée

> **Dépôt et base hébergée sont alignés** — vérifié le 16 septembre au soir : les 24 migrations
> sont appliquées, jusqu'à `20260916140000_a_remboursements_immuables.sql`, et les types régénérés
> depuis la base. `purger_prospects_inactifs(true)` y répond : zéro candidat, ce qui est
> attendu sur une base de dev qui a moins de trois ans.

> **Les comptes formateur du seed ont été renommés sur la base hébergée**, le 15 septembre.
> `coach.a@apex.test` et `coach.b@apex.test` ne répondent plus : c'est `formateur.a@apex.test`
> et `formateur.b@apex.test`, mot de passe inchangé. Seul l'email a changé — UUID, rôles et
> données liées sont intacts. Ces comptes viennent du seed, pas d'une migration, et le
> renommage `coach` → `formateur` du 8 septembre ne les avait donc pas touchés.

## La règle

**Prendre un sujet, c'est éditer sa ligne ici, committer, et pousser tout de suite.**

Le verrou, c'est Git. Une prise gardée en local ne verrouille rien — c'est exactement le cas
qu'on cherche à éviter. Un commit dédié, poussé dans la foulée, avant de commencer à coder.

À la fin, on repasse la ligne en `fait` ou on la remet `libre` si on l'abandonne. Une ligne
`pris` depuis trois jours sans commit associé est une ligne à libérer, pas un mystère.

## En cours

| Sujet                                 | État | Qui         | Depuis   |
| ------------------------------------- | ---- | ----------- | -------- |
| Intégration Discord — mise en service | pris | Christopher | 12 sept. |
| Réconciliation des rôles Discord      | pris | Christopher | 13 sept. |

**Où ça en est** : **prouvé de bout en bout sur un serveur de test, le 12 septembre.**
Liaison d'un compte, attribution du rôle `invité`, attribution d'un rôle de produit, puis
révocation par la chaîne métier — inscription expirée, `revoquer_acces_expires()`, file,
worker, rôle retiré du membre. Trois défauts trouvés et corrigés au passage, dont un qui
empêchait le worker de passer le moindre appel (le tiret cadratin de `X-Audit-Log-Reason`).

**Reste** : l'accès administrateur au serveur de production, puis y rejouer les étapes 5 à 7
(inviter le bot, créer les rôles, replacer la hiérarchie) et remplacer trois valeurs. Les
réglages Discord et Supabase, eux, ne se refont pas — l'application n'appartient à aucun
serveur. Détail dans `apps/bot/README.md`.

### Réconciliation des rôles Discord — pris le 13 septembre

**Le problème, démontré le 12 septembre.** Rien ne rattrape un rôle qui n'a pas été accordé.
La révocation a sa tâche quotidienne ; l'attribution n'a que le `grant` empilé à l'instant du
paiement ou de la liaison. Si cet instant se passe mal, la base dit « accès actif » et Discord
dit non, définitivement — et le symptôme côté client est « j'ai payé et je n'ai pas accès »,
qu'on n'apprend que s'il se plaint.

Trois façons d'y arriver, toutes rencontrées ou possibles : une variable absente (arrivé —
`DISCORD_ROLE_INVITE_ID` côté site), le worker arrêté au mauvais moment, une ligne passée en
`abandonne`. Et une quatrième, structurelle : un membre qui quitte le serveur puis le rejoint
perd ses rôles, et rien ne les lui rend.

**Ce qu'il faut** : une tâche qui compare les inscriptions actives à
`discord_links.roles_attribues` et réempile ce qui manque. Elle a sa place à côté de
`revoquer_acces_expires()`, appelée par le même planificateur.

**Bloquant avant d'ouvrir les ventes.**

## Fait

| Sujet                                                                                                                               | Quand    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vouvoiement sur tout le site                                                                                                        | 16 sept. | Tunnel (`/qualification`, `/reserver`, souscription), espace client, questions du formulaire, messages du système de messages, erreurs de paiement et de création de compte, et les quelques messages de l'espace formateur. Le back-office, qui ne parle qu'à l'équipe, n'est pas concerné ; Discord reste libre de tutoyer. Texte seulement, aucune logique touchée. **Un second passage a                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| repris quatre commentaires restés au tutoiement dans `lib/messages/preuves.ts`,                                                     |
| `components/message-url.tsx`, `api/discord/callback/route.ts` et                                                                    |
| `souscrire/bouton-renvoyer.tsx`** : ils citaient le texte d'un message juste à côté du code                                         |
| qui l'affiche, désaccordés avec lui depuis ce chantier. À garder en tête : **tout nouveau texte visible par un client se vouvoie**. |
| Espace formateur au quotidien                                                                                                       | 16 sept. | **Tableau de bord** : une file « à faire » qui nomme des personnes, dans l'ordre d'urgence — issue d'audit à consigner, proposition qui expire sous 48 h, audit honoré sans proposition, prospects à appeler triés par budget, délai et fraîcheur, contacts sans nouvelles depuis 5 jours, accès qui se terminent sous 14 jours. Chaque ligne disparaît quand le geste est fait. **Fiche** : appeler, WhatsApp, email ; « prochaine étape » ; ce qui tient dans le budget déclaré ; **consigner un échange** (appel, message, note) qui fait avancer le statut (`contacte`, `perdu` avec motif) ; historique complet. **Liste** : vues par étape, recherche, dernier échange. **Statistiques** : période, entonnoir, délais médians, audits par semaine, conversion par budget, blocage et réseau, motifs de perte. Aucun montant payé. Pas de migration : `lead_events` et la RLS existante suffisent, testées en écriture (PGlite 96, pgTAP). **Écrit dans des fichiers neufs** (`suivi-actions.ts`, `formulaire-suivi.tsx`) pour ne pas croiser la branche des messages. **Vu à l'écran, mais vide** : aucun prospect n'est affecté à un formateur sur la base partagée. Corrige aussi « aujourd'hui », calculé à l'heure du serveur et non de Paris. |
| Statistiques de conversion (branding)                                                                                               | 16 sept. | `/statistiques` : prospects, audits et clients par réseau, sur 30 jours, 90 jours, 12 mois ou depuis le début. `stats_conversion()` existait depuis le 7 septembre et n'était lue par aucun écran. Une page hors de `(admin)`, ouverte à `branding`, `admin` et `owner` ; le branding y arrive directement à la connexion, qui le laissait jusqu'ici sur le site public. **Vue à l'écran** avec de vraies sessions : branding et admin la voient, client et formateur sont renvoyés.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Planificateur Vercel                                                                                                                | 16 sept. | `apps/web/vercel.json` : révocation chaque jour à 3 h UTC, purge chaque lundi à 4 h UTC. Vercel pose lui-même `Authorization: Bearer <CRON_SECRET>`. Ne tourne qu'en production sur Vercel ; **rien n'est déployé**, et l'hébergeur n'est que recommandé. La garde du secret est désormais partagée (`lib/cron/autorisation.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Remboursements non supprimables                                                                                                     | 16 sept. | Tranche la question ouverte le 15 : une ligne de `refunds` ne se supprime jamais, une demande écartée passe en `refuse`. Déclencheur `before delete`, comme pour les factures émises — il vaut aussi contre la clé serveur, que la RLS n'arrête pas. Plutôt qu'un `or delete` sur `audit_refunds`, qui aurait documenté un geste qui ne doit pas exister. PGlite et pgTAP.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Purge des prospects inactifs                                                                                                        | 16 sept. | `purger_prospects_inactifs()` supprime un prospect sans contact **de sa part** depuis trois ans — compte, lead, formulaire, rendez-vous, consentements — et laisse une ligne `PURGE` sans donnée personnelle dans `audit_logs`. **Jamais** un compte avec une commande, une inscription ou un abonnement (quel que soit le statut), un rôle autre que `client`, ou un lead `gagne`. Mode simulation (`?simulation=1` sur `api/cron/purge-prospects`) : **à lancer avant tout premier passage sur des données reprises**, qui peuvent avoir plus de trois ans. Testée en PGlite (92) et en pgTAP (`05_purge_prospects`). **Ne retire pas** le rôle `invité` sur Discord : la file part avec le compte. Appliquée sur la base hébergée le 16 septembre. **Reste** : le planificateur, et un premier vrai passage — il n'a pas encore été lancé, seulement la simulation.                                                                                                                                                                                                                                                                                                                                                                                   |
| IP du consentement                                                                                                                  | 16 sept. | `consents.ip` existait depuis le 7 septembre et n’était jamais remplie — manque relevé par `/admin/legal`. Renseignée à la création du compte, pour les deux parcours à la fois puisque l’écriture est partagée. **Aucune migration.** La valeur est validée par `isIP()` avant d’être rendue : la colonne est `inet`, et un en-tête forgé aurait fait échouer l’`insert` du consentement entier, pas seulement l’adresse. Vérifié sur 14 cas réels — listes, ports, IPv6, valeurs bidon, injections. **Surprise utile** : en local on obtient `::1` et non `null`, le serveur de dev de Next posant lui-même `x-forwarded-for`. `/admin/legal` a été corrigé pour ne plus annoncer une colonne vide.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Audit de la suppression du contenu éditorial                                                                                        | 15 sept. | Trois déclencheurs passés en `after update or delete` — `temoignages`, `formateurs_fiches` et `formations`, ce dernier ayant le même trou hérité de `audit_offres`. `trace_audit()` savait déjà traiter un DELETE. Vérifié des deux côtés : `db:check` à 81, pgTAP à `plan(11)`, et la CI confirme 82 tests verts sous Docker. **La migration n'est pas encore sur la base hébergée** — voir l'encadré en tête.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Référencement du site public                                                                                                        | 9 sept.  | `sitemap.xml`, `robots.txt`, Open Graph, données structurées. `robots.txt` interdit tout tant que `NEXT_PUBLIC_SITE_URL` n'est pas en HTTPS.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Tunnel d'entrée au design system                                                                                                    | 9 sept.  | `/qualification`, `/connexion`, `/reserver`. A corrigé au passage une largeur de `Conteneur` qui ne s'appliquait pas sur cinq pages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Contenu éditorial — schéma                                                                                                          | 9 sept.  | Tables `temoignages` et `formateurs_fiches`, RLS, seed, pgTAP, invariants PGlite. Migration appliquée sur le projet hébergé le 9 septembre, types régénérés.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `(espace)` et `(formateur)` au design system                                                                                        | 9 sept.  | Dix-huit fichiers sortis de Tailwind brut. Navigation avec état actif, couleur Discord passée en token. **Non vérifié à l'écran** : ces pages sont derrière une garde de rôle, et la base est injoignable depuis l'environnement où le travail a été fait.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Chiffres de l'accueil                                                                                                               | 9 sept.  | Un chiffre ne s'affiche que s'il porte une source et une date. Aucun des quatre n'en a : la section a disparu de l'accueil, et y revient dès que le client répond.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| CI de `main` réparée                                                                                                                | 9 sept.  | Rouge depuis le renommage `coach` → `formateur` : le login réel visait `coach.a@apex.test`, absent du seed. Les tests pgTAP, eux, passaient.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Écrans du contenu éditorial                                                                                                         | 13 sept. | Back-office des témoignages et des fiches formateurs, `/formateurs` branchée sur les fiches, témoignages affichés sur l'accueil et les fiches produit. Plus un **guide de contenu** (`/admin/contenu`) qui montre au client la forme attendue avec des exemples fictifs, confinés au back-office. **Rien n'apparaît sur le site tant que le client n'a pas fourni sa matière** : le blocage était technique, il est désormais éditorial.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| État de connexion dans le header                                                                                                    | 12 sept. | Se connecter avec un compte staff menait à `/espace`, dont la garde refuse le rôle — on rebondissait sur l'accueil public et on se croyait déconnecté. Redirection par rôle, header qui lit la session, et une déconnexion, qui n'existait nulle part. Les pages publiques restent statiques : la session est lue dans le navigateur, pas dans le layout serveur.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Aide d'exploitation — premier runbook                                                                                               | 13 sept. | `/admin/aide`, rangé par symptôme (« j'ai payé et je n'ai pas accès »), et un bouton « Réattribuer les accès Discord » sur la fiche client. **Ce qui peut être mesuré n'est jamais affirmé** : les quatre indicateurs sont lus en base à l'affichage, donc la page ne peut pas se périmer en silence. Les entrées suivantes naîtront d'incidents réels, pas d'anticipations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Tableau de bord : « demande quelqu'un »                                                                                             | 13 sept. | Une file de travail qui **nomme des personnes**, en tête de `/admin`, avant les compteurs. Trois cas, tous constatés entre le 12 et le 13 septembre : accès actif sans Discord lié, compte lié mais absent du serveur, attribution abandonnée. Chaque ligne mène à la fiche du client, où le bouton de réattribution existe. Écarté au passage : le récap hebdomadaire par email, qui échouerait comme `/admin/logs` échoue — avec trois semaines de retard, dans un filtre.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Système de messages                                                                                                                 | 13 sept. | **Une URL transporte un accent, jamais une proposition.** Cinq mécaniques (pas trois) fusionnées : `useState` local, quatorze types d'état de `useActionState` sous trois formes incompatibles, quatre conventions de paramètre d'URL, un bloc serveur forgeable, une validation de champ. Reste `Message`, `EtatAction`, un composant qui **dérive le rôle ARIA du ton**, et un catalogue `?m=` à deux familles : constantes (vraies même forgées) et dépendantes, qui exigent une `Preuve` bornée à dix minutes et ne rendent rien sans elle. Trois défauts trouvés en inventoriant : un message orphelin (`/reserver?inscription=ok`, jamais lu), deux messages sans rôle dont « Paiement reçu », et une insertion en file non vérifiée qui laissait intact le mensonge du 12 septembre, une branche plus bas.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Pages légales — état honnête et inventaire                                                                                          | 13 sept. | Les six pages annonçaient « Placeholder — écran à construire », publiquement, et `/confidentialite` est liée depuis trois formulaires. Elles disent maintenant ce qu'elles contiendront, renvoient vers le contact, et se retirent de l'indexation tant qu'elles sont dans cet état. **Rien de juridique n'a été rédigé** — ce qui est déjà vrai est dit (ce que le code collecte, les services traversés, l'absence de traceur), le reste attend le juriste. `/admin/legal` porte l'inventaire des traitements et les questions par page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Recette à l’écran — gardes et écrans jamais vus                                                                                     | 15 sept. | Les cinq zones passées avec une vraie session de chaque rôle : les gardes sont justes, `admin` compris, refusé sur `/admin/audit` et `/admin/parametres` pendant qu’`owner` passe. Les 56 écrans répondent, aucun ne plante, et les états vides sont rédigés partout. Deux défauts corrigés : `/evenements` publiait « écran à construire », et les comptes formateur de la base de dev étaient inaccessibles. **Ce qui n’est toujours pas vu, c’est un écran plein** — voir l’observation sur la base de dev.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Libre, et rien ne l'empêche

Par ordre d'intérêt décroissant. Ce sont les sujets sur lesquels on peut se lancer
immédiatement.

| Sujet                                                 | Pourquoi ça vaut le coup                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Voir les deux rendus dépendants de Discord**        | Reste le seul rendu testable qu'on n'a pas vu : `discord-lie` avec `roleEnFile` vrai puis faux. Il faut un compte Discord **jamais relié** — le callback ne réempile pas de `grant` quand il en existe un `reussi`, donc relier `client.a` montre la branche `alerte` alors que son accès est en place. Passe par la suppression de sa ligne `discord_links` et de ses `grant` sur la base partagée : à faire en prévenant. Voir aussi l'observation sur le changement de compte Discord, plus bas. |
| Un garde-fou automatique sur le catalogue de messages | La propriété qui tient tout — **un code dépendant sans preuve ne rend rien** — n'est vérifiée par rien. Elle se casserait en silence au prochain code ajouté. Un test l'énoncerait une fois pour toutes. Ce n'est pas gratuit : `apps/web` n'a **aucun lanceur de tests**, et en introduire un est une décision (dépendance, câblage CI) qu'on n'a pas prise en fin de journée. Le runner intégré de Node évite la dépendance mais demande à lire du TypeScript.                                    |

## Bloqué, et par quoi

Ces sujets n'attendent pas un développeur. Le détail de ce qu'il faut obtenir est dans
[`08-CE-QUI-MANQUE.md`](08-CE-QUI-MANQUE.md).

| Sujet                                         | Attend                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La rédaction des six pages légales            | Les informations de la société — et surtout **laquelle des deux vend**. Les pages elles-mêmes ne sont plus des placeholders ; c'est leur contenu juridique qui attend. Ce qu'il faut obtenir est listé page par page dans `/admin/legal`.                                                                                                                                                                                                                                |
| Image Open Graph                              | La charte du designer.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Calendrier sur `/reserver`                    | `NEXT_PUBLIC_CAL_LIEN`, donc un compte Cal.com.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/admin/emails`                               | Qu'un envoi d'emails existe.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Planificateur de la révocation et de la purge | Un déploiement sur Vercel. La configuration est écrite (`apps/web/vercel.json`) ; sur un autre hébergeur, elle est à reproduire.                                                                                                                                                                                                                                                                                                                                         |
| Catalogue affichant des données fausses       | Les vrais produits — la base contient encore des données de la révision 2.                                                                                                                                                                                                                                                                                                                                                                                               |
| Hébergement du worker Discord                 | Savoir où le site est hébergé. C'est un processus long, pas une route HTTP.                                                                                                                                                                                                                                                                                                                                                                                              |
| **Voir le message `paiement-recu`**           | Un vrai encaissement, donc **les clés Stripe** et **un produit `abonnement` au catalogue** — la base partagée n'en a aucun, `/formations/[slug]/souscrire` redirige pour les deux produits existants. C'est le message dépendant qui compte le plus (« Paiement reçu » à qui n'a rien payé) et **le seul du système qu'aucun développeur ne peut essayer aujourd'hui**. Le cas forgé, lui, est vérifié : sans commande `payee` de moins de dix minutes, il ne rend rien. |

## Décisions, pas des tâches

À trancher par le client ou le chef de projet. Les coder avant la décision, c'est du travail
à refaire.

**Tranché le 16 septembre 2026** — détail dans `CLAUDE.md`, « Décisions en attente du
client » : vouvoiement sur tout le site, pas de PayPal en v1, vidéos exclusives hors projet,
pas de Supabase Pro pour le dev, conservation des prospects trois ans après le dernier
contact. **Reste ouvert côté produit** : le régime de vente et de TVA, qui attend un juriste,
et la question ci-dessous sur le retour d'un client sur le site — non tranchée le 16 septembre,
relevée le 14 en testant autre chose et toujours vraie.

- **Comment un client revient-il sur le site ? Aujourd'hui : il ne revient pas.** Décision à
  prendre à deux, relevée le 14 septembre 2026 en testant autre chose.

  **Le constat.** `creerCompteEtSession()` crée le compte avec
  `createUser({ email, email_confirm: false, user_metadata })` — **sans mot de passe**. La
  session est posée juste après par un lien magique fabriqué et consommé côté serveur, sans
  passer par la boîte mail. C'est délibéré et c'est bien vu : zéro friction sur le seul chemin
  qui produit du chiffre d'affaires.

  Sauf que `/connexion` demande un email **et un mot de passe**, et qu'il n'existe ni « mot de
  passe oublié » ni lien de connexion. Donc un vrai client est connecté juste après le
  formulaire, et le jour où son cookie expire, où il change de navigateur ou prend son
  téléphone, **il ne peut plus jamais entrer** — dans l'espace qui porte ses accès, ses
  factures, sa proposition et la résiliation de son abonnement. Rien ne l'a signalé jusqu'ici
  parce que les comptes du seed, eux, ont un mot de passe.

  ### Proposition : un lien de connexion, pas un « mot de passe oublié »

  `signInWithOtp` : on saisit son adresse, on reçoit un lien, on est connecté. Trois raisons.

  - **C'est cohérent avec la façon dont les comptes sont créés.** Proposer de réinitialiser un
    mot de passe qui n'a jamais existé est précisément le genre de phrase fausse qu'on vient de
    retirer partout ailleurs.
  - Un client revient rarement — vérifier un accès, sortir une facture, résilier. Un lien à
    cliquer bat un mot de passe qu'il n'a pas choisi et qu'il aura oublié.
  - Ça **supprime** une surface d'authentification au lieu d'en ajouter une.

  **Les comptes de l'équipe gardent le mot de passe** : eux se connectent tous les jours, et un
  aller-retour par la boîte mail à chaque fois serait intenable.

  ### Est-ce assez sûr ? Oui, et probablement plus que l'alternative

  L'objection naturelle est « un lien dans un email, c'est faible ». Il faut la comparer à ce
  qu'on ferait sinon, pas à un idéal : **un mot de passe avec « mot de passe oublié » est déjà,
  lui aussi, adossé à la boîte mail** — quiconque la contrôle réinitialise le mot de passe. Le
  lien de connexion ne déplace donc pas la confiance, il enlève juste le mot de passe qui
  s'ajoutait par-dessus. Et ce mot de passe, lui, se réutilise d'un site à l'autre, se retrouve
  dans les fuites, et se fait hameçonner. Le **credential stuffing** — rejouer des couples
  email/mot de passe fuités ailleurs — est l'attaque la plus courante contre un site comme le
  nôtre, et elle devient sans objet.

  Ce qu'il faut regarder en face :

  - **La boîte mail devient la clé du compte.** C'est déjà le cas aujourd'hui et ce le serait
    avec n'importe quelle réinitialisation. À accepter explicitement.
  - **Les liens à usage unique se font consommer par des robots.** Les antivirus et les
    filtres d'entreprise (Outlook Safe Links, par exemple) pré-ouvrent les URL des emails et
    brûlent le jeton avant le destinataire, qui se retrouve devant un lien expiré. C'est la
    vraie plaie du procédé. La parade tient en une ligne : **envoyer un code à six chiffres
    plutôt qu'un lien** (même appel `signInWithOtp`, c'est le gabarit d'email qui change), ou
    les deux. À trancher au moment de l'écrire.
  - **Durée de validité et usage unique** : une heure par défaut chez Supabase, à raccourcir.
  - **Limitation du nombre d'envois**, sans quoi on offre un moyen d'inonder une boîte mail.
  - **Pour les comptes de l'équipe, le mot de passe ne suffit pas non plus.** Un `owner` change
    les rôles, exécute des remboursements et lit tout le CRM. La double authentification par
    application (TOTP) existe chez Supabase et devrait venir avant l'ouverture des ventes —
    sujet à part, mais il naît de la même discussion.

  Pour ce que le site protège — un statut d'accès, des factures, une résiliation, et aucun
  moyen de paiement stocké puisque Stripe garde la carte de son côté — c'est proportionné.

  ### Et « Continuer avec Google » ?

  **Possible : oui, et le chemin est déjà éprouvé ici.** C'est le même mécanisme que la liaison
  Discord, qui fonctionne contre un vrai serveur depuis le 12 septembre. Supabase gère Google
  nativement ; l'identifiant et le secret se saisissent dans son tableau de bord et **ne vont
  dans aucun fichier du dépôt**, exactement comme Discord.

  **Lourd à mettre en place : non.** Un projet Google Cloud, un écran de consentement, un
  identifiant OAuth. Les portées demandées (`email`, `profile`) sont **non sensibles**, donc
  l'écran de consentement se publie **sans passer par la revue de Google** — c'est ce qui prend
  des semaines quand on demande l'accès à Gmail ou au Drive, et ça ne nous concerne pas. Compter
  une après-midi.

  **Lourd à maintenir : non plus.** Les secrets ne tournent presque jamais. Il faut garder
  valides l'adresse de contact et le domaine déclarés sur l'écran de consentement.

  **Mais deux obstacles concrets, et le premier nous bloque aujourd'hui :**

  1. **Google exige une URL de politique de confidentialité** sur un écran de consentement
     publié. La nôtre annonce qu'elle n'est pas rédigée et **se retire de l'indexation**. Google
     est donc bloqué derrière la même question que tout le reste : _quelle société vend ?_
  2. **Le risque du compte en double.** Si quelqu'un passe le tunnel avec `x@gmail.com` puis
     revient par « Continuer avec Google », il faut que Supabase rattache les deux identités au
     **même** compte et n'en crée pas un second. Supabase sait le faire quand le fournisseur a
     vérifié l'adresse, ce que Google fait — mais **c'est à vérifier en vrai avant d'ouvrir**,
     parce qu'un doublon, c'est un client qui paie sur un compte et cherche son accès sur
     l'autre. On a déjà croisé le cousin de ce problème le 14 septembre :
     `identity_already_exists`, quand un compte Discord est déjà relié ailleurs.

  **Compatible avec le lien de connexion : oui, et c'est la combinaison habituelle.** Google
  pour qui en a un, le lien pour tous les autres, les deux menant au même compte quand les
  adresses correspondent. Aucun des deux ne rend l'autre inutile.

  **Ce qu'on ne devrait pas faire : mettre Google dans le tunnel.** `/qualification` recueille
  prénom, email et téléphone et crée le compte à la fin ; tout son intérêt est que le compte
  tombe du formulaire. Y insérer un bouton Google obligerait à repenser l'étape qui produit le
  chiffre d'affaires, pour un gain nul — le prospect n'a pas encore de compte à retrouver.
  **Google a sa place sur `/connexion`, comme moyen de revenir, pas comme moyen d'entrer.**

  ### Ce que ça attend

  Les deux passent par **l'envoi d'emails de Supabase Auth**, qui n'est pas configuré. Ce n'est
  pas une dépendance nouvelle : c'est la **même** que la vérification d'adresse qui bloque déjà
  tout paiement. La configurer débloque trois choses d'un coup. Attention au détail qui coûte
  une journée : le service d'email intégré de Supabase est limité à quelques envois par heure et
  n'est pas prévu pour la production — il faut un SMTP à nous (Resend, Postmark, SES).

  **Ordre proposé** : le lien de connexion d'abord, dès que les emails partent — il débloque un
  parcours aujourd'hui sans issue. Google ensuite, quand la page de confidentialité existera.

- **Les salons Discord — tranché par défaut, sauf objection du client.** Un `invité` voit
  l'accueil, le règlement, les annonces et un salon d'échange général. Le salon planning est
  en lecture seule. Un rôle `Formateur` voit tous les salons de produit ; il s'attribue à la
  main et **le bot n'y touche jamais**. Reste à créer les salons sur le serveur de
  production, une fois l'accès obtenu.

  Ce qui est par ailleurs tranché, et vérifié le 13 septembre : **les rôles ne portent aucune
  permission serveur**. L'accès se règle salon par salon (invisible à `@everyone`, visible
  au rôle du produit). Un rôle produit avec zéro permission fonctionne.

## Observations sans propriétaire

Relevées en passant, vraies, et qui n'ont encore déclenché aucune décision.

- **La base de dev partagée porte encore les données de la révision 2, et c'est plus large
  que le catalogue.** Relevé le 15 septembre en passant les écrans en revue : `inscriptions.formateur_id`
  est NULL sur les deux inscriptions, il n'y a aucune proposition, aucun témoignage et aucune
  fiche formateur. Le seed du dépôt, lui, remplit tout cela (`seed.sql` lignes 282 et 316) — il
  n'a simplement jamais été rejoué sur la base hébergée depuis la révision 3.

  **Conséquence** : tous les écrans ne peuvent être vus qu'à vide. L'espace formateur affiche
  quatre états vides parce qu'aucun formateur n'a de client, les écrans du contenu éditorial
  livrés le 13 septembre n'ont aucune matière, et `/espace/propositions/[id]` n'est pas
  atteignable. Ce n'est un défaut d'aucun de ces écrans.

  **Pourquoi personne ne tranche seul** : rejouer le seed écrase ce qui a été saisi à la main
  sur une base que deux personnes partagent. C'est le conflit décrit dans `07-REPARTITION.md`,
  et c'est l'argument le plus concret entendu jusqu'ici pour le branching du plan Pro.

- **Le même écart a déjà mordu une fois, en silence.** `auth.users` contenait toujours
  `coach.a@apex.test` / `coach.b@apex.test` alors que le seed dit `formateur.a` / `formateur.b` :
  ces comptes viennent du seed, pas d'une migration, donc le renommage du 8 septembre ne les a
  pas touchés. Personne ne pouvait se connecter en formateur avec les identifiants documentés, et
  la CI ne le voyait pas — elle a été alignée sur le seed le 9 septembre, la base hébergée jamais.
  Corrigé le 15 septembre par un renommage des deux emails, à UUID et mot de passe inchangés.
  **La leçon est générale** : une migration corrige le schéma, jamais les données du seed déjà
  posées sur la base hébergée.

- **Changer de compte Discord ne redemande jamais le rôle `invité`.** Les lignes de
  `discord_sync_queue` portent le `user_id` du site, pas l'identifiant Discord : la route de
  rappel voit un `grant` déjà `reussi` et n'en empile pas de nouveau, alors que le rôle est dû
  au **nouveau** compte Discord, qui ne l'a pas. Relevé le 14 septembre en testant les messages.
  Sans conséquence visible aujourd'hui — `npm run discord:reconcile` compare l'état réel du
  serveur et rattrape —, mais la réconciliation n'est pas encore planifiée, donc personne ne la
  lance. Conséquence de second ordre : la page annonce alors « ton accès n'a pas pu être
  demandé », ce qui est vrai pour le nouveau compte et faux dans sa seconde phrase (« l'équipe
  est prévenue » — rien n'est journalisé dans ce cas).

- **Le rôle de « Fondations » s'appelle `Fondation` au singulier sur le serveur de test.**
  Sans conséquence technique — le code ne compare que des identifiants — mais à corriger
  avant de reproduire la structure en production, sous peine de la recopier.
