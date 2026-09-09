# Répartition du travail à deux

> **Le découpage par couche décrit ici n'a plus cours** (9 septembre 2026). Il supposait deux
> développeurs à charge égale et des périmètres étanches ; la répartition se fait désormais
> **par sujet**, dans [`09-CHANTIERS.md`](09-CHANTIERS.md), et personne n'est limité à une
> couche. Ce qui reste entièrement valable dans ce document : les **trois fichiers qui posent
> réellement problème** et le **conflit sur la base de dev partagée**, plus bas.

Deux développeurs travaillent en parallèle sur ce dépôt. Ce document existe pour une
seule raison : **éviter que deux personnes modifient le même fichier le même jour.**
Les conflits Git sur du code applicatif se résolvent ; les conflits sur une migration
SQL déjà appliquée en base, non.

S'y ajoute un conflit que Git ne verra jamais, parce qu'il ne porte sur aucun fichier :
la base de dev est partagée entre les deux postes.

## Principe de découpage

Le découpage n'est pas « par phase » mais **par couche**, parce que les phases se
chevauchent dans le temps alors que les couches ne se touchent presque jamais.

|             | Développeur A — _serveur et données_                                                               | Développeur B — _interface_                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Possède** | `supabase/**`, `apps/bot/**`, `packages/db/**`, `apps/web/app/api/**`, `apps/web/lib/server/**`    | `apps/web/app/(public)/**`, `apps/web/app/(espace)/**`, `apps/web/app/(admin)/**`, `apps/web/components/**`, styles |
| **Sujets**  | Schéma, RLS, webhooks Stripe / PayPal / Cal.com, facturation, bot Discord, URL signées des replays | Site public et tunnel, espace client, écrans du back-office, design system, formulaires                             |
| **Phases**  | 1, 3, 4, et la moitié serveur de 5                                                                 | 2, 6, et la moitié écrans de 5                                                                                      |

**Personne ne possède** : `package.json`, `package-lock.json`, `CLAUDE.md`,
`docs/**`, la configuration CI. Ces fichiers se modifient en le disant à l'autre,
dans un commit dédié, poussé tout de suite.

## Les trois fichiers qui posent réellement problème

### 1. Les migrations SQL

Une migration n'est **jamais** modifiée après avoir été poussée. Une correction est
une nouvelle migration. Cette règle vaut déjà seul ; à deux elle est non négociable,
parce que l'autre a déjà appliqué le fichier sur sa base locale.

Pour éviter deux migrations au même horodatage, chacun préfixe la sienne avec son
initiale dans le libellé :

```
20260908093000_a_paiement_relances.sql
20260908094500_b_offres_champs_marketing.sql
```

Si les deux ont besoin d'une migration le même jour, **A passe en premier** : les
politiques RLS de A conditionnent souvent ce que B peut lire.

### 2. `packages/db/src/database.types.ts`

Fichier **généré**, jamais édité à la main. Marqué comme tel dans `.gitattributes`,
donc Git ne tente pas de fusionner son contenu. En cas de conflit, on ne résout pas :

```bash
git checkout --theirs packages/db/src/database.types.ts
npm run db:reset && npm run db:types
```

### 3. `package-lock.json`

Le conflit type est « les deux ont ajouté une dépendance le même jour ». On ne
fusionne pas non plus :

```bash
git checkout --theirs package-lock.json
npm install
```

Corollaire : **annoncer l'ajout d'une dépendance** avant de l'installer. Une
bibliothèque de dates ou de formulaires choisie deux fois différemment coûte plus
cher que le message qu'on n'aura pas envoyé.

## Le conflit qui n'est pas dans Git : la base de dev partagée

Tout ce qui précède protège le dépôt. Rien ne protège la base.

Les deux développeurs travaillent contre **le même projet Supabase hébergé**
(`ovlafpgmrwttxstodqxi`, un projet gratuit qui sert de base de dev commune), parce que
Docker est bloqué sur les deux postes et qu'aucune instance locale n'est possible — voir
`CLAUDE.md`, « Docker n'est pas disponible en local ». Git isole les fichiers, il n'isole
pas les données. Trois façons de s'en apercevoir, toutes possibles dès aujourd'hui :

- **A applique une migration.** L'application de B change sous ses doigts, sans qu'il ait
  fait un seul `git pull`. Un écran qui marchait à 14 h ne marche plus à 14 h 10, et rien
  dans son historique local ne l'explique.
- **B se connecte avec un compte du seed et modifie des données.** Les vérifications de A
  voient des lignes que `seed.sql` ne décrit pas. Le seed est censé être une interface
  (voir plus bas) ; sur une base partagée et mutable, il cesse de décrire son propre
  contenu au premier `insert` fait à la main.
- **Une migration en cours de revue est déjà appliquée.** Si A la pousse sur la base
  commune pour l'essayer, B la subit avant qu'elle soit relue — donc y compris si la
  revue finit par la refuser.

Aucune de ces situations ne produit un conflit Git. Elles produisent une heure passée à
chercher un bug qui n'est pas dans le code.

### Ce qu'on fait en attendant

- **La boucle de vérification est `npm run db:check`, pas la base partagée.** PGlite est
  jetable et local : chacun la sienne, personne ne marche sur l'autre. C'est la seule
  vérification qui reste reproductible.
- **Annoncer une migration appliquée sur la base commune**, exactement comme on annonce
  l'ajout d'une dépendance. Même raison, même coût du message qu'on n'aura pas envoyé.
- **Ne pas créer de données de confort avec les comptes du seed.** Si un cas manque, il
  s'ajoute dans `supabase/seed.sql` et se rejoue ; il ne se tape pas dans l'interface.
- Garder en tête que **les projets gratuits sont suspendus après une semaine
  d'inactivité**. Un lundi matin sans base n'est pas une panne.

### Ce qui réglerait le problème — à arbitrer

Le plan Pro de Supabase (25 $/mois par organisation, 10 $ de crédits compute inclus, soit
une instance Micro) débloque le **branching** : une base éphémère par pull request,
migrations et `seed.sql` appliqués automatiquement, supprimée à la fermeture de la PR,
facturée à l'usage — de l'ordre de 0,013 $/h en Micro.

Ça correspond exactement au flux décrit ci-dessous : une branche par sujet, deux jours de
vie maximum, tout par PR. Une branche de deux jours coûte donc quelques dizaines de
centimes, et l'isolation devient **par fonctionnalité plutôt que par développeur** — la
migration de A en cours de revue ne touche plus la base de B.

Deux points à vérifier avant de s'engager : que l'intégration GitHub du branching
fonctionne sur un dépôt privé en plan gratuit, et l'activation du seeding dans
`supabase/config.toml`. À noter que le palier gratuit plafonne de toute façon à deux
projets actifs par organisation, ce qui interdit déjà « une prod plus deux bases de dev »
sans passer à Pro.

Ce qui ne change pas avec Pro : le développement hors ligne reste impossible, et
`npm run db:check` garde tout son intérêt comme boucle rapide.

## Flux Git

**Personne ne pousse directement sur `main`.**

C'est une convention, pas une contrainte technique : la protection de branche de
GitHub n'est pas disponible sur un dépôt privé en plan gratuit (l'API répond 403).
Rien n'empêche donc matériellement un `git push origin main`. La règle tient parce
que les deux développeurs la respectent, pas parce que le serveur la refuse — ce qui
veut dire qu'il faut y penser, surtout en fin de journée.

Deux façons de la rendre réelle si le besoin s'en fait sentir : passer le dépôt en
public (la protection devient gratuite) ou prendre GitHub Pro. À arbitrer par
Anthony ; en attendant, la CI reste le vrai garde-fou, puisqu'elle échoue sur toute
politique RLS cassée, y compris sur `main`.

```bash
git checkout main && git pull
git checkout -b a/paiement-stripe     # ou b/espace-client-replays
# … travail, commits …
git push -u origin a/paiement-stripe
```

Préfixe de branche `a/` ou `b/`. Une branche vit **deux jours au maximum** : au-delà,
elle diverge assez pour que la fusion coûte plus que la fonctionnalité. Rebaser sur
`main` tous les matins.

Merci de ne pas relire mécaniquement la PR de l'autre : les deux relectures qui
comptent ici sont **une politique RLS ajoutée ou modifiée** et **un handler de
webhook**. Le reste peut être fusionné sur confiance.

## Contrat d'interface entre les deux

B construit des écrans sur des données que A n'a pas encore écrites. Pour ne pas
attendre, A livre **d'abord** le schéma et les types, ensuite la logique :

1. A pousse la migration et `npm run db:types`.
2. B développe contre les types générés et le jeu de `supabase/seed.sql`.
3. A branche la logique réelle derrière.

Ce qui veut dire que **le seed est une interface**, pas un jeu de données de confort.
Y ajouter un cas, c'est débloquer un écran chez l'autre : à faire volontiers, en
prévenant.

## En cas de doute

Le fichier appartient à celui dont la couche est nommée dans le tableau. Si le besoin
traverse la frontière — B a besoin d'une requête serveur, A a besoin d'un écran de
diagnostic — c'est une demande à l'autre, pas une incursion. Deux minutes de message
contre une heure de conflit.
