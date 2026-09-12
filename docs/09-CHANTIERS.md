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

| Sujet                                 | État | Qui         | Depuis   |
| ------------------------------------- | ---- | ----------- | -------- |
| Intégration Discord — mise en service | pris | Christopher | 12 sept. |

**Où ça en est** : `npm run discord:check` est écrit — un diagnostic en lecture seule de
toute la chaîne, jeton compris, et surtout de la hiérarchie des rôles, qui est ce qui casse
à tous les coups la première fois. La marche à suivre est dans `apps/bot/README.md`, et ses
six premières étapes se font depuis un navigateur et l'application Discord, sans le dépôt.
Restent à faire, sur un poste : créer l'application Discord, remplir `apps/bot/.env` et
`apps/web/.env.local`, lancer le diagnostic, puis un vrai aller-retour de rôle.
| Écrans du contenu éditorial (back-office + pages publiques) | libre | — | — |

## Fait

| Sujet                                        | Quand    | Notes                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Référencement du site public                 | 9 sept.  | `sitemap.xml`, `robots.txt`, Open Graph, données structurées. `robots.txt` interdit tout tant que `NEXT_PUBLIC_SITE_URL` n'est pas en HTTPS.                                                                                                                                                                                                                      |
| Tunnel d'entrée au design system             | 9 sept.  | `/qualification`, `/connexion`, `/reserver`. A corrigé au passage une largeur de `Conteneur` qui ne s'appliquait pas sur cinq pages.                                                                                                                                                                                                                              |
| Contenu éditorial — schéma                   | 9 sept.  | Tables `temoignages` et `formateurs_fiches`, RLS, seed, pgTAP, invariants PGlite. Migration appliquée sur le projet hébergé le 9 septembre, types régénérés.                                                                                                                                                                                                      |
| `(espace)` et `(formateur)` au design system | 9 sept.  | Dix-huit fichiers sortis de Tailwind brut. Navigation avec état actif, couleur Discord passée en token. **Non vérifié à l'écran** : ces pages sont derrière une garde de rôle, et la base est injoignable depuis l'environnement où le travail a été fait.                                                                                                        |
| Chiffres de l'accueil                        | 9 sept.  | Un chiffre ne s'affiche que s'il porte une source et une date. Aucun des quatre n'en a : la section a disparu de l'accueil, et y revient dès que le client répond.                                                                                                                                                                                                |
| CI de `main` réparée                         | 9 sept.  | Rouge depuis le renommage `coach` → `formateur` : le login réel visait `coach.a@apex.test`, absent du seed. Les tests pgTAP, eux, passaient.                                                                                                                                                                                                                      |
| État de connexion dans le header             | 12 sept. | Se connecter avec un compte staff menait à `/espace`, dont la garde refuse le rôle — on rebondissait sur l'accueil public et on se croyait déconnecté. Redirection par rôle, header qui lit la session, et une déconnexion, qui n'existait nulle part. Les pages publiques restent statiques : la session est lue dans le navigateur, pas dans le layout serveur. |

## Libre, et rien ne l'empêche

Par ordre d'intérêt décroissant. Ce sont les sujets sur lesquels on peut se lancer
immédiatement.

| Sujet                                                   | Pourquoi ça vaut le coup                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Écrans du contenu éditorial                             | Débloqué : la migration est appliquée et `database.types.ts` connaît `temoignages` et `formateurs_fiches`. Rien ne manque pour commencer.                                                                                                                                                                           |
| Revérifier les gardes de layout avec de vraies sessions | Les écrans de `(espace)` et `(formateur)` sont passés au design system sans jamais être vus : ils sont derrière une garde de rôle et la base était injoignable. Depuis un poste qui l'atteint, c'est une heure de travail.                                                                                          |
| Système de messages (succès, erreur, information)       | Il n'en existe aucun. Chaque écran improvise : `/connexion` garde son erreur dans un `useState`, `/espace/communaute` lit un `?discord=ok` dans l'URL, et un retour de paiement n'a nulle part où se dire. À concevoir une fois — un composant et une convention d'URL — avant que chaque page n'invente la sienne. |

## Bloqué, et par quoi

Ces sujets n'attendent pas un développeur. Le détail de ce qu'il faut obtenir est dans
[`08-CE-QUI-MANQUE.md`](08-CE-QUI-MANQUE.md).

| Sujet                                      | Attend                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Les six pages légales                      | Les informations de la société — et surtout **laquelle des deux vend**.               |
| Image Open Graph                           | La charte du designer.                                                                |
| Calendrier sur `/reserver`                 | `NEXT_PUBLIC_CAL_LIEN`, donc un compte Cal.com.                                       |
| `/admin/emails`                            | Qu'un envoi d'emails existe.                                                          |
| Planificateur de la révocation quotidienne | Savoir où le site est hébergé. Sans lui, `revoquer_acces_expires()` ne tourne jamais. |
| Catalogue affichant des données fausses    | Les vrais produits — la base contient encore des données de la révision 2.            |
| Hébergement du worker Discord              | Savoir où le site est hébergé. C'est un processus long, pas une route HTTP.           |

## Décisions, pas des tâches

À trancher par le client ou le chef de projet. Les coder avant la décision, c'est du travail
à refaire.

- **Tutoiement ou vouvoiement.** Le site mélange les deux : « Vous faites le point » sur
  l'accueil, « Réserve ton audit » sur `/reserver` et `/qualification`. Il faut choisir.
- Les décisions encore ouvertes de `CLAUDE.md` : hébergement des vidéos exclusives, régime de
  vente et de TVA, plan Supabase Pro.
