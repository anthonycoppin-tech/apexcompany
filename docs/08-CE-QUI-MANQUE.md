# Ce qui manque pour mettre en service

Écrit le 8 septembre 2026. Ce document recense **tout ce que le code attend de l'extérieur** :
accès techniques, informations juridiques, contenu, décisions. Il ne contient aucune tâche de
développement — celles-là vivent dans `06-PERIMETRE.md` et dans l'état d'avancement de
`CLAUDE.md`.

Il est fait pour être parcouru par quelqu'un qui va chercher les réponses, pas par un
développeur. Chaque ligne dit **ce qui manque**, **où ça se met** et **ce qui ne marche pas
sans**.

**Ce document est fait pour être rempli.** Le tableau récapitulatif de la section 6 attend les
réponses : on l'annote au fur et à mesure, on le commite, et le développement reprend avec ce
qui est là plutôt qu'en attendant que tout soit là.

> **Aucune clé, aucun secret, aucun mot de passe dans ce fichier.** Il est versionné dans Git,
> donc lisible par tous ceux qui ont accès au dépôt, et un secret commité reste dans
> l'historique même après suppression. Les clés se transmettent autrement et se posent
> directement dans l'environnement du serveur. Ici on note seulement **qu'une clé a été
> fournie**, jamais sa valeur.

**Rien de la plateforme n'a jamais tourné contre les vrais services.** Le code est écrit,
vérifié par les tests et compilé, mais aucun paiement réel, aucun rôle Discord réel et aucun
rendez-vous réel n'a été traité. C'est la première chose que la liste ci-dessous permettra de
changer.

Une fois les clés en place, `/admin/parametres` (réservé au rôle `owner`) affiche en direct ce
qui est configuré et ce qui manque encore. C'est le premier écran à ouvrir.

---

## 1. Accès techniques

Ils bloquent la vérification de tout le parcours. Sans eux, on ne peut affirmer que « ça
compile », jamais que « ça marche ».

### Discord — le plus bloquant

**Aucune application Discord n'existe aujourd'hui**, et le worker `apps/bot` n'a jamais tourné.
C'est bloquant dès l'entrée du tunnel, puisque c'est là que le rôle `invité` est attribué.

| À fournir                                                | Variable                                     |
| -------------------------------------------------------- | -------------------------------------------- |
| Identifiant du serveur Discord                           | `DISCORD_GUILD_ID`                           |
| Jeton du bot                                             | `DISCORD_BOT_TOKEN`                          |
| Identifiant et secret de l'application (connexion OAuth) | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` |
| Identifiant du rôle `invité`                             | `DISCORD_ROLE_INVITE_ID`                     |

Deux réglages à faire sur le serveur, et le second est un piège classique :

1. Inviter le bot avec la permission **Gérer les rôles**.
2. **Placer le rôle du bot au-dessus** de tous ceux qu'il doit attribuer, dans la hiérarchie du
   serveur. Sans ça, chaque attribution échoue en 403, quel que soit le code.

Il faut aussi **activer le fournisseur Discord côté Supabase** (Authentication → Providers) avec
les mêmes identifiant et secret, et déclarer l'URL de retour
`https://ovlafpgmrwttxstodqxi.supabase.co/auth/v1/callback` dans les redirections OAuth de
l'application Discord.

**Sans ça** : aucun accès n'est jamais attribué ni retiré. Un client peut payer et ne rien
recevoir.

### Supabase — la clé serveur

`SUPABASE_SERVICE_ROLE_KEY` est **vide** dans `.env.local`. Elle se récupère dans les réglages
du projet hébergé.

**Sans elle** : le formulaire de qualification ne crée ni compte ni prospect. Le tunnel ne
démarre pas du tout.

### Stripe

| À fournir         | Variable                             |
| ----------------- | ------------------------------------ |
| Clé secrète       | `STRIPE_SECRET_KEY`                  |
| Secret du webhook | `STRIPE_WEBHOOK_SECRET`              |
| Clé publique      | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |

Le webhook doit pointer vers `https://<le-site>/api/stripe`.

**Sans elles** : aucun paiement ne s'ouvre, aucun encaissement n'est reçu, aucun remboursement
ne s'exécute.

### Cal.com

| À fournir                                         | Variable                   |
| ------------------------------------------------- | -------------------------- |
| Adresse de la page de réservation de Franck       | `NEXT_PUBLIC_CAL_LIEN`     |
| Secret du webhook                                 | `CAL_WEBHOOK_SECRET`       |
| Identifiant du compte de Franck sur la plateforme | `AUDIT_CONSEILLER_USER_ID` |

Un seul compte suffit : c'est Franck qui prend tous les audits, il n'y a ni page d'équipe ni
aiguillage entre formateurs.

**Une vérification de cinq minutes à faire à l'inscription** : le réglage « Webhooks » est-il
disponible sur le plan gratuit ? La grille tarifaire les liste dans la colonne Teams alors que
la documentation n'annonce aucune restriction. S'ils sont payants, c'est 12 $ par mois pour une
personne.

**Sans webhook** : aucun rendez-vous n'est enregistré en base. Donc pas de tableau de bord
formateur, pas de fiche client à jour, et pas de statistique de rendez-vous non honorés.

### Envoi d'emails

`RESEND_API_KEY` et `EMAIL_FROM`, ou l'équivalent configuré côté Supabase.

**Attention, c'est bloquant pour les ventes** : la vérification de l'adresse email est
obligatoire avant de payer — décision prise, et implémentée. Si l'envoi d'emails ne fonctionne
pas, **aucun paiement ne peut aboutir**. C'est le comportement voulu, mais il faut avoir essayé
un vrai parcours d'achat avant d'ouvrir les ventes.

### Tâche planifiée

`CRON_SECRET`, plus un planificateur qui appelle `https://<le-site>/api/cron/revocation` une fois
par jour, avec ce secret en en-tête `Authorization`.

**Sans lui** : la révocation existe et ne tourne jamais. Les accès expirés restent ouverts
indéfiniment — et personne ne le signale, parce qu'un client satisfait ne prévient pas qu'il a
encore accès.

### PayPal

Prévu au schéma mais non implémenté. Les variables `PAYPAL_*` restent vides tant que le second
prestataire n'est pas décidé.

---

## 2. Informations juridiques

**Les six pages légales sont vides.** Elles ne peuvent pas être écrites sans ces réponses, et
en inventer serait pire que de les laisser en attente.

Le contrat de prestation transmis apprend que **APEX COMPANY LLC-FZ** est une société de zone
franche immatriculée 264 5781 à Dubaï, dirigée par Franck Alexandre, et mentionne une seconde
entité, **NEURO TRADE APEX LLC**.

| Question                                                 | Pourquoi                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| **Laquelle des deux sociétés vend aux clients finaux ?** | Elle figure dans les mentions légales et émet les factures |
| Qui héberge le site — nom et adresse                     | Mention obligatoire en droit français                      |
| Directeur de la publication                              | Mention obligatoire                                        |
| Adresse de contact, et adresse dédiée aux demandes RGPD  | Obligatoire, et attendue sur la page de contact            |
| Médiateur de la consommation retenu                      | Obligatoire pour qui vend à des consommateurs français     |
| Régime de TVA retenu                                     | Voir ci-dessous                                            |

### Trois points pour un conseil, pas pour les développeurs

Le vendeur est aux Émirats, les clients sont dans l'Union. Ça déplace le sujet, et le contrat
qui désigne le droit de Dubaï ne l'écarte pas : ces protections suivent le consommateur.

- **La TVA due dans l'Union par un vendeur qui n'y est pas établi** — un régime précis existe
  (guichet unique dit non-Union). Ce n'est pas la même question que « la TVA hors Europe ».
- **Le droit de rétractation de quatorze jours**, qui s'applique aux consommateurs européens
  indépendamment du lieu d'établissement du vendeur dès lors qu'il vise ce marché. Il a des
  conséquences directes sur les CGV et sur la page de remboursement.
- **Un représentant dans l'Union au sens du RGPD**, exigé d'un responsable de traitement établi
  hors Union qui cible des résidents européens.

Ces questions se posent **avant la première vente**, pas avant la première facture : c'est la
mise en vente qui les déclenche.

---

## 3. Contenu

Rien de tout cela n'a été inventé, et rien ne le sera : une biographie ou un témoignage
fabriqué sur un site de formation en investissement est un risque, pas un espace réservé.

### Le catalogue réel — le manque le plus visible

Le site n'est que le reflet du catalogue, et **celui de la base partagée porte encore des
données de la révision 2** : « Accélérateur » y est enregistré comme une formation en groupe
alors que c'est un accompagnement individuel, et aucun abonnement n'existe.

Conséquence directe : le parcours d'achat d'abonnement, écrit et livré, **ne peut pas être
essayé** faute de produit de ce type.

Pour chaque produit : nom, description, tarif, type (abonnement / accompagnement / formation),
suivi (individuel ou groupe), durée d'accès pour un accompagnement, objectifs pédagogiques,
prérequis, et l'identifiant de son rôle Discord.

Bonne nouvelle : **tout cela se saisit désormais depuis `/admin/formations`**, sans SQL. Un
produit ne peut pas être publié sans rôle Discord — il encaisserait un paiement sans ouvrir
d'accès.

### Le reste

| À fournir                                           | Où ça sert                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| Biographies et photos des formateurs                | `/formateurs`, aujourd'hui sans aucune fiche                                |
| Témoignages réels, avec accord écrit de publication | La section n'a pas été créée faute de matière                               |
| Source et date des quatre chiffres de l'accueil     | 80+ apprenants, 9/10, 100 %, 24 h — **retirés de l'affichage en attendant** |
| Logo et visuels                                     | C'est le principal écart visuel avec la référence citée                     |
| Une preuve sociale externe, si elle existe          | Type Trustpilot — c'est ce qui porte la crédibilité chez le concurrent cité |

Un chiffre de réassurance invérifiable se retourne contre celui qui l'affiche, et il vieillit
sans prévenir. Les quatre chiffres **ne s'affichent plus** : le code exige désormais une
source et une date de vérification pour publier un chiffre, et aucun n'en a. Ce n'est donc
plus une consigne à retenir avant la mise en ligne, c'est le comportement par défaut.

Ce qu'il faut fournir pour chacun, dans ce cas : d'où il sort (registre interne, enquête,
plateforme d'avis) et à quelle date il a été relevé. La date s'affiche à côté du chiffre —
c'est ce qui le rend croyable, et ce qui permettra de voir qu'il a vieilli.

---

## 4. Décisions en attente

Une seule reste ouverte côté produit.

**Où vivent les vidéos exclusives ?** L'un des deux abonnements annoncés donne accès à des
vidéos exclusives. Si elles sont sur Discord, il n'y a rien à construire. Si elles sont sur le
site, la règle « jamais d'URL de vidéo en base » se réveille, et avec elle le lecteur à accès
restreint et les URL signées que la révision 3 avait justement retirés du périmètre. **Ça se
chiffre en semaines** — à trancher avant la phase abonnement.

Une dépense reste aussi à arbitrer : **le plan Supabase Pro, 25 $ par mois**. Ce qu'on achète
réellement, c'est une base isolée par chantier — ce qui supprime les conflits sur la base de
développement partagée entre les deux développeurs — et la fin de la mise en veille du projet
après une semaine d'inactivité. Argumentaire dans `07-REPARTITION.md`.

---

## 5. Dans quel ordre

1. **La clé serveur Supabase.** Une minute, et sans elle rien ne démarre.
2. **Discord.** Le plus long à mettre en place, et le plus bloquant.
3. **Le catalogue réel.** Il conditionne tout ce qu'on peut essayer ensuite.
4. **Cal.com**, avec la vérification des webhooks.
5. **Stripe**, puis un vrai parcours d'achat de bout en bout — c'est le test qui compte.
6. **L'envoi d'emails**, à vérifier avant d'ouvrir les ventes, sous peine de les bloquer toutes.
7. **Le planificateur** de la révocation quotidienne.
8. **Le juridique**, en parallèle et sans attendre : c'est ce qui a le plus long délai.

---

## 6. Récapitulatif à remplir

À compléter avec le chef de projet. Remplacer les `—` par la réponse, ou par « fourni le
JJ/MM » pour une clé — **jamais par la clé elle-même**.

### Accès techniques

| Élément                               | État | Qui s'en occupe | Note |
| ------------------------------------- | ---- | --------------- | ---- |
| Clé serveur Supabase                  | —    | —               | —    |
| Serveur Discord créé                  | —    | —               | —    |
| Application et bot Discord            | —    | —               | —    |
| Rôle `invité` créé, bot au-dessus     | —    | —               | —    |
| Fournisseur Discord activé (Supabase) | —    | —               | —    |
| Compte Cal.com de Franck              | —    | —               | —    |
| Webhooks Cal.com disponibles ?        | —    | —               | —    |
| Clés Stripe et webhook                | —    | —               | —    |
| Envoi d'emails configuré              | —    | —               | —    |
| Planificateur de la révocation        | —    | —               | —    |
| Nom de domaine et hébergement du site | —    | —               | —    |

### Juridique

| Question                                  | Réponse |
| ----------------------------------------- | ------- |
| Société qui vend aux clients finaux       | —       |
| Numéro d'immatriculation de cette société | —       |
| Adresse du siège                          | —       |
| Directeur de la publication               | —       |
| Hébergeur du site — nom et adresse        | —       |
| Adresse de contact                        | —       |
| Adresse pour les demandes RGPD            | —       |
| Médiateur de la consommation              | —       |
| Régime de TVA retenu                      | —       |
| Représentant dans l'Union (RGPD)          | —       |
| Conseil juridique consulté ?              | —       |

### Contenu

| Élément                                       | État | Note |
| --------------------------------------------- | ---- | ---- |
| Catalogue réel saisi dans `/admin/formations` | —    | —    |
| Biographies et photos des formateurs          | —    | —    |
| Témoignages, avec accord écrit                | —    | —    |
| Chiffres de réassurance validés et datés      | —    | —    |
| Logo et visuels                               | —    | —    |
| Charte graphique du designer                  | —    | —    |
| Preuve sociale externe (type Trustpilot)      | —    | —    |

### Décisions

| Question                                  | Réponse |
| ----------------------------------------- | ------- |
| Où vivent les vidéos exclusives ?         | —       |
| Plan Supabase Pro — 25 $/mois             | —       |
| Second prestataire de paiement (PayPal) ? | —       |
