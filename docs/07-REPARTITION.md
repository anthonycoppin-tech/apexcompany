# Répartition du travail à deux

Deux développeurs travaillent en parallèle sur ce dépôt. Ce document existe pour une
seule raison : **éviter que deux personnes modifient le même fichier le même jour.**
Les conflits Git sur du code applicatif se résolvent ; les conflits sur une migration
SQL déjà appliquée en base, non.

## Principe de découpage

Le découpage nest pas « par phase » mais **par couche**, parce que les phases se
chevauchent dans le temps alors que les couches ne se touchent presque jamais.

|             | Développeur A — _serveur et données_                                                               | Développeur B — _interface_                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Possède** | `supabase/**`, `apps/bot/**`, `packages/db/**`, `apps/web/app/api/**`, `apps/web/lib/server/**`    | `apps/web/app/(public)/**`, `apps/web/app/(espace)/**`, `apps/web/app/(admin)/**`, `apps/web/components/**`, styles |
| **Sujets**  | Schéma, RLS, webhooks Stripe / PayPal / Cal.com, facturation, bot Discord, URL signées des replays | Site public et tunnel, espace client, écrans du back-office, design system, formulaires                             |
| **Phases**  | 1, 3, 4, et la moitié serveur de 5                                                                 | 2, 6, et la moitié écrans de 5                                                                                      |

**Personne ne possède** : `package.json`, `package-lock.json`, `CLAUDE.md`,
`docs/**`, la configuration CI. Ces fichiers se modifient en le disant à lautre,
dans un commit dédié, poussé tout de suite.

## Les trois fichiers qui posent réellement problème

### 1. Les migrations SQL

Une migration nest **jamais** modifiée après avoir été poussée. Une correction est
une nouvelle migration. Cette règle vaut déjà seul ; à deux elle est non négociable,
parce que lautre a déjà appliqué le fichier sur sa base locale.

Pour éviter deux migrations au même horodatage, chacun préfixe la sienne avec son
initiale dans le libellé :

```
20260908093000_a_paiement_relances.sql
20260908094500_b_offres_champs_marketing.sql
```

Si les deux ont besoin dune migration le même jour, **A passe en premier** : les
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

Corollaire : **annoncer lajout dune dépendance** avant de linstaller. Une
bibliothèque de dates ou de formulaires choisie deux fois différemment coûte plus
cher que le message quon naura pas envoyé.

## Flux Git

`main` est protégée : personne ny pousse directement.

```bash
git checkout main && git pull
git checkout -b a/paiement-stripe     # ou b/espace-client-replays
# … travail, commits …
git push -u origin a/paiement-stripe
```

Préfixe de branche `a/` ou `b/`. Une branche vit **deux jours au maximum** : au-delà,
elle diverge assez pour que la fusion coûte plus que la fonctionnalité. Rebaser sur
`main` tous les matins.

Merci de ne pas relire mécaniquement la PR de lautre : les deux relectures qui
comptent ici sont **une politique RLS ajoutée ou modifiée** et **un handler de
webhook**. Le reste peut être fusionné sur confiance.

## Contrat dinterface entre les deux

B construit des écrans sur des données que A na pas encore écrites. Pour ne pas
attendre, A livre **dabord** le schéma et les types, ensuite la logique :

1. A pousse la migration et `npm run db:types`.
2. B développe contre les types générés et le jeu de `supabase/seed.sql`.
3. A branche la logique réelle derrière.

Ce qui veut dire que **le seed est une interface**, pas un jeu de données de confort.
Y ajouter un cas, cest débloquer un écran chez lautre : à faire volontiers, en
prévenant.

## En cas de doute

Le fichier appartient à celui dont la couche est nommée dans le tableau. Si le besoin
traverse la frontière — B a besoin dune requête serveur, A a besoin dun écran de
diagnostic — cest une demande à lautre, pas une incursion. Deux minutes de message
contre une heure de conflit.
