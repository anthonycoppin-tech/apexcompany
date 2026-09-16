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

> **Une migration est dans le dépôt et pas sur la base hébergée.**
> `20260915100000_a_audit_suppression.sql`, poussée sur `main` le 15 septembre. Elle ajoute
> `or delete` à trois déclencheurs d'audit — validée par `npm run db:check` sur PGlite, **pas
> appliquée** sur le projet hébergé, parce que `db:push` écrit sur la base partagée et que la
> règle est de prévenir avant.
>
> **Qui la pousse** : le premier des deux qui lit ceci et peut lancer `npm run db:push`, après
> avoir prévenu l'autre. Elle ne change aucun type — pas de `db:types:linked` derrière. Une
> fois faite, remplacer cet encadré par une ligne dans `Fait`.
>
> Tant qu'elle n'est pas appliquée, supprimer un témoignage sur la base de dev n'écrit
> toujours rien dans `audit_logs`, alors que le dépôt et les tests affirment le contraire.

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

| Sujet                                             | État | Qui         | Depuis   |
| ------------------------------------------------- | ---- | ----------- | -------- |
| Intégration Discord — mise en service             | pris | Christopher | 12 sept. |
| Réconciliation des rôles Discord                  | pris | Christopher | 13 sept. |
| Système de messages (succès, erreur, information) | pris | Christopher | 13 sept. |
| IP du consentement                                | pris | Anthony     | 16 sept. |

**Pour le système de messages : ce qu'il y a à balayer.** Les écrans du contenu éditorial,
livrés le 13 septembre, avaient besoin d'afficher des succès et des erreurs. Ils n'ont inventé
**aucune** convention et ont repris le motif déjà présent dans le code — `role="status"` et
`role="alert"` en ligne, comme `/espace/compte`. C'est donc une mécanique de plus à reprendre,
pas une de plus à supprimer.

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

### Système de messages — pris le 13 septembre

**Il n'en existe aucun**, et trois mécaniques différentes se partagent le besoin :
`/connexion` garde son erreur dans un `useState`, `/espace/communaute` lit un `?discord=ok`
dans l'URL, et un retour de paiement n'a nulle part où se dire.

À concevoir **une fois** — un composant et une convention d'URL — avant que chaque écran
n'invente la sienne. La décision de ne pas l'improviser dans le correctif du 12 septembre
tient toujours : c'est ce qui aurait produit une quatrième mécanique.

Trois familles à couvrir : le succès, l'erreur, et l'information. Et un cas limite à ne pas
oublier, celui qui a motivé ce chantier : un message qui affirme quelque chose de faux
(« ton accès arrive dans la minute » après un échec enregistré) est pire que pas de message.

### IP du consentement — pris le 16 septembre

**Le manque.** `/admin/legal` l'a fait apparaître le 13 septembre : la colonne `consents.ip`
existe depuis la migration du 7 septembre et **n'est jamais remplie**. Elle est `inet`, donc
prévue, pas oubliée à la conception — c'est l'écriture qui ne la renseigne pas.

**Pourquoi ça compte.** Une preuve de consentement se juge sur ce qu'elle permet de
reconstituer : qui, quand, à quoi, et depuis où. Les trois premiers sont là — `user_id` ou
`email`, `created_at`, `version_texte`. L'origine manque, et c'est précisément ce qu'on nous
demandera le jour où quelqu'un affirme n'avoir jamais coché la case. Une colonne prévue et
vide est pire qu'une colonne absente : elle laisse croire que la donnée existe.

**Ce que ça touche.** Une seule écriture, dans `lib/auth/creation-compte.ts`. **Aucune
migration** — la colonne existe déjà, donc rien à pousser sur la base partagée.

**Le piège à ne pas rater** : derrière un hébergeur, `request.ip` est celui du proxy, pas du
visiteur. C'est `x-forwarded-for` qu'il faut lire, en prenant **la première** adresse de la
liste, et en acceptant que la valeur soit absente en local — auquel cas on écrit `null` plutôt
qu'une adresse inventée. Une preuve qui ment est pire que pas de preuve, ce qui est la même
règle que pour les chiffres de l'accueil et les indicateurs de `/admin/aide`.

## Fait

| Sujet                                           | Quand    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Audit de la suppression du contenu éditorial    | 15 sept. | Trois déclencheurs passés en `after update or delete` — `temoignages`, `formateurs_fiches` et `formations`, ce dernier ayant le même trou hérité de `audit_offres`. `trace_audit()` savait déjà traiter un DELETE. Vérifié des deux côtés : `db:check` à 81, pgTAP à `plan(11)`, et la CI confirme 82 tests verts sous Docker. **La migration n'est pas encore sur la base hébergée** — voir l'encadré en tête.                                                                                                                            |
| Référencement du site public                    | 9 sept.  | `sitemap.xml`, `robots.txt`, Open Graph, données structurées. `robots.txt` interdit tout tant que `NEXT_PUBLIC_SITE_URL` n'est pas en HTTPS.                                                                                                                                                                                                                                                                                                                                                                                               |
| Tunnel d'entrée au design system                | 9 sept.  | `/qualification`, `/connexion`, `/reserver`. A corrigé au passage une largeur de `Conteneur` qui ne s'appliquait pas sur cinq pages.                                                                                                                                                                                                                                                                                                                                                                                                       |
| Contenu éditorial — schéma                      | 9 sept.  | Tables `temoignages` et `formateurs_fiches`, RLS, seed, pgTAP, invariants PGlite. Migration appliquée sur le projet hébergé le 9 septembre, types régénérés.                                                                                                                                                                                                                                                                                                                                                                               |
| `(espace)` et `(formateur)` au design system    | 9 sept.  | Dix-huit fichiers sortis de Tailwind brut. Navigation avec état actif, couleur Discord passée en token. **Non vérifié à l'écran** : ces pages sont derrière une garde de rôle, et la base est injoignable depuis l'environnement où le travail a été fait.                                                                                                                                                                                                                                                                                 |
| Chiffres de l'accueil                           | 9 sept.  | Un chiffre ne s'affiche que s'il porte une source et une date. Aucun des quatre n'en a : la section a disparu de l'accueil, et y revient dès que le client répond.                                                                                                                                                                                                                                                                                                                                                                         |
| CI de `main` réparée                            | 9 sept.  | Rouge depuis le renommage `coach` → `formateur` : le login réel visait `coach.a@apex.test`, absent du seed. Les tests pgTAP, eux, passaient.                                                                                                                                                                                                                                                                                                                                                                                               |
| Écrans du contenu éditorial                     | 13 sept. | Back-office des témoignages et des fiches formateurs, `/formateurs` branchée sur les fiches, témoignages affichés sur l'accueil et les fiches produit. Plus un **guide de contenu** (`/admin/contenu`) qui montre au client la forme attendue avec des exemples fictifs, confinés au back-office. **Rien n'apparaît sur le site tant que le client n'a pas fourni sa matière** : le blocage était technique, il est désormais éditorial.                                                                                                   |
| État de connexion dans le header                | 12 sept. | Se connecter avec un compte staff menait à `/espace`, dont la garde refuse le rôle — on rebondissait sur l'accueil public et on se croyait déconnecté. Redirection par rôle, header qui lit la session, et une déconnexion, qui n'existait nulle part. Les pages publiques restent statiques : la session est lue dans le navigateur, pas dans le layout serveur.                                                                                                                                                                          |
| Aide d'exploitation — premier runbook           | 13 sept. | `/admin/aide`, rangé par symptôme (« j'ai payé et je n'ai pas accès »), et un bouton « Réattribuer les accès Discord » sur la fiche client. **Ce qui peut être mesuré n'est jamais affirmé** : les quatre indicateurs sont lus en base à l'affichage, donc la page ne peut pas se périmer en silence. Les entrées suivantes naîtront d'incidents réels, pas d'anticipations.                                                                                                                                                               |
| Tableau de bord : « demande quelqu'un »         | 13 sept. | Une file de travail qui **nomme des personnes**, en tête de `/admin`, avant les compteurs. Trois cas, tous constatés entre le 12 et le 13 septembre : accès actif sans Discord lié, compte lié mais absent du serveur, attribution abandonnée. Chaque ligne mène à la fiche du client, où le bouton de réattribution existe. Écarté au passage : le récap hebdomadaire par email, qui échouerait comme `/admin/logs` échoue — avec trois semaines de retard, dans un filtre.                                                               |
| Pages légales — état honnête et inventaire      | 13 sept. | Les six pages annonçaient « Placeholder — écran à construire », publiquement, et `/confidentialite` est liée depuis trois formulaires. Elles disent maintenant ce qu'elles contiendront, renvoient vers le contact, et se retirent de l'indexation tant qu'elles sont dans cet état. **Rien de juridique n'a été rédigé** — ce qui est déjà vrai est dit (ce que le code collecte, les services traversés, l'absence de traceur), le reste attend le juriste. `/admin/legal` porte l'inventaire des traitements et les questions par page. |
| Recette à l’écran — gardes et écrans jamais vus | 15 sept. | Les cinq zones passées avec une vraie session de chaque rôle : les gardes sont justes, `admin` compris, refusé sur `/admin/audit` et `/admin/parametres` pendant qu’`owner` passe. Les 56 écrans répondent, aucun ne plante, et les états vides sont rédigés partout. Deux défauts corrigés : `/evenements` publiait « écran à construire », et les comptes formateur de la base de dev étaient inaccessibles. **Ce qui n’est toujours pas vu, c’est un écran plein** — voir l’observation sur la base de dev.                             |

## Libre, et rien ne l'empêche

Par ordre d'intérêt décroissant. Ce sont les sujets sur lesquels on peut se lancer
immédiatement.

| Sujet | Pourquoi ça vaut le coup |
| ----- | ------------------------ |

## Bloqué, et par quoi

Ces sujets n'attendent pas un développeur. Le détail de ce qu'il faut obtenir est dans
[`08-CE-QUI-MANQUE.md`](08-CE-QUI-MANQUE.md).

| Sujet                                      | Attend                                                                                                                                                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La rédaction des six pages légales         | Les informations de la société — et surtout **laquelle des deux vend**. Les pages elles-mêmes ne sont plus des placeholders ; c'est leur contenu juridique qui attend. Ce qu'il faut obtenir est listé page par page dans `/admin/legal`. |
| Image Open Graph                           | La charte du designer.                                                                                                                                                                                                                    |
| Calendrier sur `/reserver`                 | `NEXT_PUBLIC_CAL_LIEN`, donc un compte Cal.com.                                                                                                                                                                                           |
| `/admin/emails`                            | Qu'un envoi d'emails existe.                                                                                                                                                                                                              |
| Planificateur de la révocation quotidienne | Savoir où le site est hébergé. Sans lui, `revoquer_acces_expires()` ne tourne jamais.                                                                                                                                                     |
| Catalogue affichant des données fausses    | Les vrais produits — la base contient encore des données de la révision 2.                                                                                                                                                                |
| Hébergement du worker Discord              | Savoir où le site est hébergé. C'est un processus long, pas une route HTTP.                                                                                                                                                               |

## Décisions, pas des tâches

À trancher par le client ou le chef de projet. Les coder avant la décision, c'est du travail
à refaire.

- **L'arborescence des salons Discord — trois questions, et elles bloquent la seule chose
  qui reste à construire côté Discord.** Un client reçoit aujourd'hui son rôle et ne voit
  rien de nouveau : aucun salon n'existe. Or c'est ce qui remplace Circle et Zoom
  (`06-PERIMETRE.md`, « La visioconférence »).

  1. **Que voit un `invité` ?** C'est l'état d'avant-achat de tout le monde — un salon
     d'accueil, une présentation, rien du tout ? La spécification est muette.
  2. **Le salon planning est-il en lecture seule ?** Le cahier des charges dit « l'équipe y
     publie le planning hebdomadaire », ce qui se lit comme un salon d'annonces, mais ce
     n'est écrit nulle part.
  3. **Y a-t-il un rôle « équipe » ou « formateur » côté Discord ?** Aujourd'hui non — les
     formateurs voient donc les salons de produit par quel moyen ?

  Ce qui est en revanche tranché, et vérifié le 13 septembre : **les rôles ne portent aucune
  permission serveur**. L'accès se règle salon par salon (invisible à `@everyone`, visible
  au rôle du produit). Un rôle produit avec zéro permission fonctionne.

- **Tutoiement ou vouvoiement.** Le site mélange les deux : « Vous faites le point » sur
  l'accueil, « Réserve ton audit » sur `/reserver` et `/qualification`. Il faut choisir.
- Les décisions encore ouvertes de `CLAUDE.md` : hébergement des vidéos exclusives, régime de
  vente et de TVA, plan Supabase Pro.

## Observations sans propriétaire

Relevées en passant, vraies, et qui n'ont encore déclenché aucune décision.

- **La base de dev partagée porte encore les données de la révision 2, et c’est plus large
  que le catalogue.** Relevé le 15 septembre en passant les écrans en revue : `inscriptions.formateur_id`
  est NULL sur les deux inscriptions, il n’y a aucune proposition, aucun témoignage et aucune
  fiche formateur. Le seed du dépôt, lui, remplit tout cela (`seed.sql` lignes 282 et 316) — il
  n’a simplement jamais été rejoué sur la base hébergée depuis la révision 3.

  **Conséquence** : tous les écrans ne peuvent être vus qu’à vide. L’espace formateur affiche
  quatre états vides parce qu’aucun formateur n’a de client, les écrans du contenu éditorial
  livrés le 13 septembre n’ont aucune matière, et `/espace/propositions/[id]` n’est pas
  atteignable. Ce n’est un défaut d’aucun de ces écrans.

  **Pourquoi personne ne tranche seul** : rejouer le seed écrase ce qui a été saisi à la main
  sur une base que deux personnes partagent. C’est le conflit décrit dans `07-REPARTITION.md`,
  et c’est l’argument le plus concret entendu jusqu’ici pour le branching du plan Pro.

- **Le même écart a déjà mordu une fois, en silence.** `auth.users` contenait toujours
  `coach.a@apex.test` / `coach.b@apex.test` alors que le seed dit `formateur.a` / `formateur.b` :
  ces comptes viennent du seed, pas d’une migration, donc le renommage du 8 septembre ne les a
  pas touchés. Personne ne pouvait se connecter en formateur avec les identifiants documentés, et
  la CI ne le voyait pas — elle a été alignée sur le seed le 9 septembre, la base hébergée jamais.
  Corrigé le 15 septembre par un renommage des deux emails, à UUID et mot de passe inchangés.
  **La leçon est générale** : une migration corrige le schéma, jamais les données du seed déjà
  posées sur la base hébergée.

- **`audit_refunds` ne trace pas la suppression, et personne n'a tranché si c'est un
  problème.** Relevé le 15 septembre en corrigeant le même trou sur le contenu publié. Le
  déclencheur est en `after insert or update` : supprimer une ligne de `refunds` effacerait la
  trace d'un mouvement d'argent. Il a été laissé dehors volontairement — l'argent a ses propres
  règles dans ce dépôt, et y toucher en passant, dans une migration qui parle de témoignages,
  n'est pas le bon geste. Le correctif serait le même one-liner.

  **Ce qu'il faut décider avant** : est-ce qu'une ligne de `refunds` est censée pouvoir être
  supprimée un jour ? Si la réponse est non, ce n'est pas un déclencheur qu'il faut ajouter mais
  une interdiction, comme celle qui protège déjà les factures émises.

- **Le rôle de « Fondations » s'appelle `Fondation` au singulier sur le serveur de test.**
  Sans conséquence technique — le code ne compare que des identifiants — mais à corriger
  avant de reproduire la structure en production, sous peine de la recopier.
- **Le rôle applicatif `branding` n'a aucune destination.** `destinationApresConnexion()`
  le renvoie sur le site public, faute d'espace à lui. Or le pôle branding a un besoin
  identifié — savoir quel réseau convertit, ce que le `?src=` du tunnel capte déjà
  (`02-SITEMAP.md`) — sans un écran pour le servir.
