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

**L'application et le bot existent, et tournent sur un serveur de test** depuis le
12 septembre 2026. Ce qui manque, c'est **l'accès administrateur au serveur de production**,
pour y rejouer l'installation (`apps/bot/README.md`) et remplacer les identifiants ci-dessous.
C'est bloquant dès l'entrée du tunnel, puisque c'est là que le rôle `invité` est attribué.

| À fournir                                                | Variable                                  |
| -------------------------------------------------------- | ----------------------------------------- |
| Identifiant du serveur Discord                           | `DISCORD_GUILD_ID`                        |
| Jeton du bot                                             | `DISCORD_BOT_TOKEN`                       |
| Identifiant et secret de l'application (connexion OAuth) | À saisir dans le tableau de bord Supabase |
| Identifiant du rôle `invité`                             | `DISCORD_ROLE_INVITE_ID`                  |
| Lien d'invitation permanent au serveur                   | `NEXT_PUBLIC_DISCORD_INVITE_URL`          |

Deux réglages à faire sur le serveur, et le second est un piège classique :

1. Inviter le bot avec la permission **Gérer les rôles**.
2. **Placer le rôle du bot au-dessus** de tous ceux qu'il doit attribuer, dans la hiérarchie du
   serveur. Sans ça, chaque attribution échoue en 403, quel que soit le code.

Il faut aussi **activer le fournisseur Discord côté Supabase** (Authentication → Providers) avec
les mêmes identifiant et secret, et déclarer l'URL de retour
`https://ovlafpgmrwttxstodqxi.supabase.co/auth/v1/callback` dans les redirections OAuth de
l'application Discord.

Et un troisième réglage, dans le même écran, qu'on ne trouve qu'en le cherchant : **« Enable
Manual Linking » doit être activé**. Il est désactivé par défaut, et sans lui `linkIdentity()`
échoue — c'est-à-dire que le bouton « Connecter mon compte Discord » ne peut jamais aboutir,
quel que soit l'état du reste. L'exigence vient de `@supabase/auth-js`, pas de notre code.

**Sans ça** : aucun accès n'est jamais attribué ni retiré. Un client peut payer et ne rien
recevoir.

Le **lien d'invitation** est le seul des quatre à n'avoir aucune conséquence technique
immédiate : rien ne casse sans lui. Il devient nécessaire le jour où l'on relance quelqu'un qui
a payé sans rejoindre le serveur — décidé le 13 septembre 2026 — puisqu'une relance qui ne dit
pas où aller ne sert à rien. À créer en **invitation permanente, sans expiration** : une
invitation qui périme transforme la relance en impasse, et personne ne s'en aperçoit avant la
première plainte.

### Supabase — la clé serveur — **fournie**

`SUPABASE_SERVICE_ROLE_KEY` est renseignée depuis le 12 septembre 2026 et lit bien la base
hébergée. Elle reste à reporter sur l'hébergement du site et sur celui du worker le jour où
ils existent.

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

**Les emails automatiques du site** (paiement reçu, proposition, relances) partent par Resend
directement, depuis une tâche horaire. Sans ces deux variables, rien ne part — et le domaine de
`EMAIL_FROM` doit être vérifié chez Resend (trois enregistrements DNS), sans quoi Resend refuse.

**Attention, c'est bloquant pour les ventes** : la vérification de l'adresse email est
obligatoire avant de payer — décision prise, et implémentée. Si l'envoi d'emails ne fonctionne
pas, **aucun paiement ne peut aboutir**. C'est le comportement voulu, mais il faut avoir essayé
un vrai parcours d'achat avant d'ouvrir les ventes.

**C'est aussi le seul moyen, pour un client, de revenir sur le site.** Depuis le 17 septembre,
les clients se connectent par un email (lien et code), jamais par un mot de passe. Sans envoi
d'emails, un client dont la session a expiré ne peut plus entrer dans son espace.

**Le service d'emails intégré à Supabase ne suffit pas** : il n'écrit qu'aux membres de
l'organisation Supabase, et quelques emails par heure. Il faut brancher un vrai service (Resend
ou équivalent) dans _Authentication → Emails → SMTP Settings_.

**Les modèles d'email et l'adresse de retour sont prêts dans le dépôt**
(`supabase/templates/`) et se posent en une commande, sur chaque projet — dev, puis production :

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npm run auth:modeles -- <référence-du-projet>
```

Le jeton se crée sur supabase.com/dashboard/account/tokens et se supprime juste après : il ouvre
tous les projets du compte.

**Bloqué aujourd'hui** : un projet gratuit refuse toute modification des modèles tant qu'il
envoie par le service intégré (constaté le 17 septembre sur le projet de dev). Il faut **l'un des
deux** : le plan Pro, ou un SMTP configuré. Le plan Pro seul débloque les modèles, mais pas
l'envoi aux vrais clients — le SMTP reste indispensable avant d'ouvrir les ventes.

Tant que les modèles ne sont pas posés, la connexion marche quand même, avec deux limites : le
lien ne fonctionne **que dans le navigateur qui l'a demandé** (un client qui lit ses emails sur
son téléphone ne peut pas se connecter sur son ordinateur), et l'email, en anglais, ne contient
pas le code.

**Déjà fait sur le projet de dev** : l'adresse de retour `http://localhost:3000/connexion/confirmer`
est autorisée. Sur le projet de production, `Site URL` doit valoir l'adresse réelle du site —
la commande autorise alors `<Site URL>/connexion/confirmer` d'elle-même.

### Tâche planifiée

`CRON_SECRET`, plus un planificateur qui appelle `https://<le-site>/api/cron/revocation` une fois
par jour, avec ce secret en en-tête `Authorization`.

**Déjà écrit pour Vercel** (`apps/web/vercel.json`, 16 septembre 2026) : la révocation chaque
jour à 3 h UTC, la purge des prospects inactifs chaque lundi à 4 h UTC. Vercel envoie tout seul
`Authorization: Bearer <CRON_SECRET>` dès que la variable existe dans le projet — il suffit de
la renseigner. Les tâches ne tournent que sur le déploiement de production. Sur un autre
hébergeur, ce fichier est ignoré et il faut reproduire ces deux appels.

Avant le **premier** passage de la purge sur des données reprises de l'ancien site, appeler une
fois `/api/cron/purge-prospects?simulation=1` : ces données peuvent avoir plus de trois ans.

**Sans lui** : la révocation existe et ne tourne jamais. Les accès expirés restent ouverts
indéfiniment — et personne ne le signale, parce qu'un client satisfait ne prévient pas qu'il a
encore accès.

### PayPal

**Pas en v1** — tranché le 16 septembre 2026. Prévu au schéma, non implémenté, variables
`PAYPAL_*` vides.

---

## 2. Informations juridiques

**Les six pages légales sont vides.** Elles ne peuvent pas être écrites sans ces réponses, et
en inventer serait pire que de les laisser en attente.

Depuis le 13 septembre elles ne disent plus « Placeholder — écran à construire » : chacune
annonce ce qu'elle contiendra, renvoie vers le contact, et **se retire de l'indexation** tant
qu'elle est dans cet état. `/confidentialite` et `/cookies` disent en plus ce qui est déjà
vrai — ce que le code collecte, chez qui ça transite, et qu'aucun traceur n'est posé. Rien de
juridique n'y a été rédigé pour autant : c'est ce tableau qui débloque la rédaction.

**L'inventaire des traitements est prêt, lui, et il est dans `/admin/legal`** — quelles données
dans quelle table, écrites par quoi, et ce qui reste à trancher pour chacune. C'est la première
chose qu'un juriste demande ; l'apporter au rendez-vous évite un aller-retour par question.

Le contrat de prestation transmis apprend que **APEX COMPANY LLC-FZ** est une société de zone
franche immatriculée 264 5781 à Dubaï, dirigée par Franck Alexandre, et mentionne une seconde
entité, **NEURO TRADE APEX LLC**.

| Question                                                        | Pourquoi                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| **Laquelle des deux sociétés vend aux clients finaux ?**        | Elle figure dans les mentions légales et émet les factures |
| Qui héberge le site — nom et adresse                            | Mention obligatoire en droit français                      |
| Directeur de la publication                                     | Mention obligatoire                                        |
| Adresse de contact, et adresse dédiée aux demandes RGPD         | Obligatoire, et attendue sur la page de contact            |
| Médiateur de la consommation retenu                             | Obligatoire pour qui vend à des consommateurs français     |
| Régime de TVA retenu                                            | Voir ci-dessous                                            |
| Trois ans pour un prospect inactif (CNIL) : le juriste valide ? | Tranché par défaut le 16/09 ; la purge est écrite (16/09)  |

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

> **Le plus simple est d'ouvrir `/admin/contenu`.** Cette page montre les vraies sections du
> site remplies avec des exemples, et dit ce qui distingue un témoignage publiable d'un
> témoignage inutilisable. Les exemples y sont fictifs et ne quittent jamais le back-office —
> ils servent à expliquer la forme attendue, pas à meubler le site.

| À fournir                                           | Où ça sert                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Biographies et photos des formateurs                | `/formateurs`, aujourd'hui sans aucune fiche — saisie dans `/admin/formateurs` |
| Témoignages réels, avec accord écrit de publication | Accueil et fiches produit — saisie dans `/admin/temoignages`                   |
| Source et date des quatre chiffres de l'accueil     | 80+ apprenants, 9/10, 100 %, 24 h — **retirés de l'affichage en attendant**    |
| Logo et visuels                                     | C'est le principal écart visuel avec la référence citée                        |
| Une preuve sociale externe, si elle existe          | Type Trustpilot — c'est ce qui porte la crédibilité chez le concurrent cité    |
| Le contenu de tous les emails envoyés               | Clients et formateurs — voir ci-dessous                                        |

### Les emails : le texte est au client

Le site enverra des emails automatiques. **Le ton, les formulations et la signature sont au
client** : ce sont ses mots qui partent dans la boîte de ses clients. Des brouillons existent,
en vouvoiement, pour montrer la forme attendue — à relire, corriger ou réécrire :

| Email                                       | Destinataire | Quand il part                                  | Brouillon                              |
| ------------------------------------------- | ------------ | ---------------------------------------------- | -------------------------------------- |
| Lien de connexion (avec code)               | Client       | Chaque demande de connexion                    | `supabase/templates/connexion.html`    |
| Confirmation d'adresse (avec code)          | Client       | Adresse pas encore vérifiée                    | `supabase/templates/confirmation.html` |
| Paiement reçu                               | Client       | Après chaque encaissement                      | `apps/web/src/lib/email/modeles.ts`    |
| Proposition reçue                           | Client       | Quand le formateur émet une proposition        | idem                                   |
| Relance : connecter son Discord             | Client       | Deux jours après l'achat, si Discord non relié | idem                                   |
| Fin d'accès proche                          | Client       | Sept jours avant la fin d'un accompagnement    | idem                                   |
| Nouveau prospect, rendez-vous réservé, etc. | Formateur    | **À décider** : aucun n'existe encore          | —                                      |

Pour chacun, il faut : le **sujet**, le **texte**, la **signature** (nom de la société qui
vend, adresse de contact) et, côté formateur, **la liste des notifications voulues**. Les
mentions légales de pied d'email attendent, comme les pages légales, de savoir qui vend.

**Deux refus qui ne se contournent pas**, et qui valent d'être connus avant de rassembler la
matière : un témoignage ne se publie pas sans consentement enregistré, et un chiffre ne
s'affiche pas sans source ni date de relevé. Ce ne sont pas des options d'interface — l'écran
de saisie et la base refusent tous les deux.

Un chiffre de réassurance invérifiable se retourne contre celui qui l'affiche, et il vieillit
sans prévenir. Les quatre chiffres **ne s'affichent plus** : le code exige désormais une
source et une date de vérification pour publier un chiffre, et aucun n'en a. Ce n'est donc
plus une consigne à retenir avant la mise en ligne, c'est le comportement par défaut.

Ce qu'il faut fournir pour chacun, dans ce cas : d'où il sort (registre interne, enquête,
plateforme d'avis) et à quelle date il a été relevé. La date s'affiche à côté du chiffre —
c'est ce qui le rend croyable, et ce qui permettra de voir qu'il a vieilli.

---

## 4. Décisions en attente

**Aucune ne reste ouverte côté produit** depuis le 16 septembre 2026 : vidéos exclusives sur
une plateforme externe (hors projet), vouvoiement, pas de PayPal en v1, pas de Supabase Pro
pour le développement, salons Discord par défaut, prospects conservés trois ans. Détail et
raisons dans `CLAUDE.md`. Reste le régime de vente et de TVA, qui est une question de juriste
(section 2).

---

## 4 bis. Abonnements à la charge du client

Ordres de grandeur relevés le 16 septembre 2026, **à vérifier au moment de souscrire** — les
grilles changent. Les comptes sont ouverts **au nom du client**, qui les paie ; les
développeurs y sont invités.

| Service                         | Pour quoi                                              | Coût                                                       |
| ------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| Nom de domaine                  | L'adresse du site                                      | ~10–20 € par an                                            |
| Vercel (plan Pro)               | Héberger le site et la tâche quotidienne de révocation | ~20 $ par mois — le plan gratuit exclut l'usage commercial |
| Railway ou équivalent           | Faire tourner le bot Discord en continu                | ~5 $ par mois                                              |
| Supabase (plan Pro, production) | Base de données, comptes, **sauvegardes quotidiennes** | 25 $ par mois — recommandé dès l'ouverture des ventes      |
| Stripe                          | Encaisser les paiements                                | Pas d'abonnement, une commission par paiement              |
| Resend ou équivalent            | Emails de confirmation — **sans eux, aucun paiement**  | Gratuit au départ, ~20 $ par mois au-delà du quota         |
| Cal.com                         | Prise de rendez-vous de l'audit                        | Gratuit, ou ~12 $ par mois si les webhooks sont payants    |
| Discord                         | Communauté et accès des clients                        | Gratuit                                                    |
| Boîtes email professionnelles   | Contact et demandes RGPD, si elles n'existent pas déjà | ~6–8 € par mois par boîte                                  |
| Médiateur de la consommation    | Obligation légale de vente aux particuliers            | Adhésion, souvent annuelle                                 |

Hors de cette liste : la plateforme des vidéos exclusives, hors projet, et le conseil
juridique, qui est une dépense ponctuelle.

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

| Élément                               | État             | Qui s'en occupe | Note |
| ------------------------------------- | ---------------- | --------------- | ---- |
| Clé serveur Supabase                  | fournie le 12/09 | —               | —    |
| Serveur Discord créé                  | —                | —               | —    |
| Application et bot Discord            | —                | —               | —    |
| Rôle `invité` créé, bot au-dessus     | —                | —               | —    |
| Fournisseur Discord activé (Supabase) | —                | —               | —    |
| Compte Cal.com de Franck              | —                | —               | —    |
| Webhooks Cal.com disponibles ?        | —                | —               | —    |
| Clés Stripe et webhook                | —                | —               | —    |
| Envoi d'emails configuré              | —                | —               | —    |
| Planificateur de la révocation        | —                | —               | —    |
| Nom de domaine et hébergement du site | —                | —               | —    |

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

| Question                                  | Réponse                                             |
| ----------------------------------------- | --------------------------------------------------- |
| Où vivent les vidéos exclusives ?         | Plateforme externe, hors projet (16/09)             |
| Plan Supabase Pro — 25 $/mois             | Pas besoin pour le dev (16/09) ; recommandé en prod |
| Second prestataire de paiement (PayPal) ? | Pas en v1 (16/09)                                   |
| Tutoiement ou vouvoiement                 | Vouvoiement (16/09)                                 |
