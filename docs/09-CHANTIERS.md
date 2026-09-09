# Chantiers — qui travaille sur quoi

Ce fichier existe pour une seule raison : **empêcher que deux personnes fassent le même
travail sans le savoir.** Il remplace le découpage par couche de
[`07-REPARTITION.md`](07-REPARTITION.md), qui supposait deux développeurs à charge égale et
des périmètres étanches — ce n'est pas ce qui se passe. Personne n'est limité à une couche :
on prend un sujet, on le dit ici, on avance.

Ce qui reste valable dans `07-REPARTITION.md` : les trois fichiers qui posent réellement
problème (migrations, `database.types.ts`, `package-lock.json`), et le conflit sur la base de
dev partagée. Ça n'a pas changé.

## La règle

**Prendre un sujet, c'est éditer sa ligne ici, committer, et pousser tout de suite.**

Le verrou, c'est Git. Une prise gardée en local ne verrouille rien — c'est exactement le cas
qu'on cherche à éviter. Un commit dédié, poussé dans la foulée, avant de commencer à coder.

À la fin, on repasse la ligne en `fait` ou on la remet `libre` si on l'abandonne. Une ligne
`pris` depuis trois jours sans commit associé est une ligne à libérer, pas un mystère.

## En cours

| Sujet                                                       | État  | Qui              | Depuis  |
| ----------------------------------------------------------- | ----- | ---------------- | ------- |
| `(espace)` et `(formateur)` au design system                | pris  | Anthony + Claude | 9 sept. |
| Écrans du contenu éditorial (back-office + pages publiques) | libre | —                | —       |

## Fait

| Sujet                            | Quand   | Notes                                                                                                                                        |
| -------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Référencement du site public     | 9 sept. | `sitemap.xml`, `robots.txt`, Open Graph, données structurées. `robots.txt` interdit tout tant que `NEXT_PUBLIC_SITE_URL` n'est pas en HTTPS. |
| Tunnel d'entrée au design system | 9 sept. | `/qualification`, `/connexion`, `/reserver`. A corrigé au passage une largeur de `Conteneur` qui ne s'appliquait pas sur cinq pages.         |
| Contenu éditorial — schéma       | 9 sept. | Tables `temoignages` et `formateurs_fiches`, RLS, seed, pgTAP, invariants PGlite. **Migration pas encore poussée.**                          |

## Libre, et rien ne l'empêche

Par ordre d'intérêt décroissant. Ce sont les sujets sur lesquels on peut se lancer
immédiatement.

| Sujet                       | Pourquoi ça vaut le coup                                                                                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Écrans du contenu éditorial | Dépend de `db:push` + `db:types:linked` — voir « Bloqué » ci-dessous. Le schéma, lui, est prêt.                                                                                                                |
| Chiffres de l'accueil       | Codés en dur avec un avertissement dans le code : « à faire valider et à dater avant la mise en ligne ». Soit ils passent en base comme le reste du contenu, soit ils sont datés et sourcés, soit ils sautent. |

## Bloqué, et par quoi

Ces sujets n'attendent pas un développeur. Le détail de ce qu'il faut obtenir est dans
[`08-CE-QUI-MANQUE.md`](08-CE-QUI-MANQUE.md).

| Sujet                                                   | Attend                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pousser la migration du contenu éditorial               | `db:push` puis `db:types:linked`, depuis un poste qui a un jeton Supabase et un accès réseau à `supabase.co`. Tant que ce n'est pas fait, aucun écran ne peut être typé. |
| Les six pages légales                                   | Les informations de la société — et surtout **laquelle des deux vend**.                                                                                                  |
| Image Open Graph                                        | La charte du designer.                                                                                                                                                   |
| Calendrier sur `/reserver`                              | `NEXT_PUBLIC_CAL_LIEN`, donc un compte Cal.com.                                                                                                                          |
| `/admin/emails`                                         | Qu'un envoi d'emails existe.                                                                                                                                             |
| Planificateur de la révocation quotidienne              | Savoir où le site est hébergé. Sans lui, `revoquer_acces_expires()` ne tourne jamais.                                                                                    |
| Revérifier les gardes de layout avec de vraies sessions | Un accès réseau à la base hébergée.                                                                                                                                      |
| Catalogue affichant des données fausses                 | Les vrais produits — la base contient encore des données de la révision 2.                                                                                               |

## Décisions, pas des tâches

À trancher par le client ou le chef de projet. Les coder avant la décision, c'est du travail
à refaire.

- **Tutoiement ou vouvoiement.** Le site mélange les deux : « Vous faites le point » sur
  l'accueil, « Réserve ton audit » sur `/reserver` et `/qualification`. Il faut choisir.
- Les décisions encore ouvertes de `CLAUDE.md` : hébergement des vidéos exclusives, régime de
  vente et de TVA, plan Supabase Pro.
