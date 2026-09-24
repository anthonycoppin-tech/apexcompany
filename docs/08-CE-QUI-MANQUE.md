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

**Une seule partie de la plateforme a tourné contre un vrai service** : Discord, le
12 septembre, sur un serveur de test — liaison d'un compte, attribution d'un rôle, révocation
en fin d'accès. **Le reste est écrit, testé et compilé, jamais exécuté en vrai** : aucun
paiement, aucun rendez-vous, aucun email. C'est la première chose que la liste ci-dessous
permettra de changer.

Une fois les clés en place, `/admin/parametres` (réservé au rôle `owner`) affiche en direct ce
qui est configuré et ce qui manque encore. C'est le premier écran à ouvrir.

## Où ça en est — 24 septembre 2026

Relu de bout en bout après la journée du 23 septembre, qui a fait bouger trois choses de cette
liste. **Ce qui a été livré par le client** : la charte graphique (une bannière), le document
des seize liens de paiement Whop, le lien d'invitation Discord et les comptes de la marque.
**Ce que ça a fermé** : le catalogue de la base, qui affichait des produits faux depuis le
8 septembre, et l'image de partage, qui attendait la charte.

**Les quatre manques qui bloquent réellement la vente**, dans l'ordre :

1. ~~les neuf identifiants de rôle Discord~~ — **fait le 24 septembre** : les rôles sont créés,
   les neuf produits publiés, et les trois produits du jeu d'essai retirés de la vente. À
   refaire sur le serveur de production le jour venu, par une commande (section 3) ;
2. **le nom de domaine**, qui commande l'envoi des emails, l'adresse du webhook, l'indexation
   et les mentions légales (section 4 bis) ;
3. **les trois clés Whop**, et une heure dans le bac à sable — rien du chemin de l'argent n'a
   jamais tourné contre le vrai service (section 1) ;
4. **la relecture juridique**, qui a le plus long délai et qui porte maintenant une question de
   plus : dans le mode fiscal retenu, c'est Whop qui émet la facture fiscale, pas APEX COMPANY
   (section 2).

Le reste — biographies, témoignages, logo, textes des emails — ne bloque pas une vente, mais
laisse des sections vides sur un site qui vend cher.

**Et une question qui n'était posée nulle part, ajoutée le 24 septembre** : les clients qui
achètent déjà par les liens Whop n'existent pas dans la base. À la mise en ligne, ils n'ont
aucun espace client, et leur demander de reprendre un abonnement leur ferait payer deux fois
(section 3 bis).

---

## 1. Accès techniques

Ils bloquent la vérification de tout le parcours. Sans eux, on ne peut affirmer que « ça
compile », jamais que « ça marche ».

### Discord — le plus bloquant

**L'application et le bot existent, et tournent sur un serveur de test** depuis le
12 septembre 2026. Ce qui manque, c'est **l'accès administrateur au serveur de production**,
pour y rejouer l'installation (`apps/bot/README.md`) et remplacer les identifiants ci-dessous.
C'est bloquant dès l'entrée du tunnel, puisque c'est là que le rôle `invité` est attribué.

| À fournir                                                | Variable                                             |
| -------------------------------------------------------- | ---------------------------------------------------- |
| Identifiant du serveur Discord                           | `DISCORD_GUILD_ID`                                   |
| Jeton du bot                                             | `DISCORD_BOT_TOKEN`                                  |
| Identifiant et secret de l'application (connexion OAuth) | À saisir dans le tableau de bord Supabase            |
| ~~Identifiant du rôle `invité`~~                         | **Fourni le 24 septembre**, `DISCORD_ROLE_INVITE_ID` |
| ~~Lien d'invitation permanent au serveur~~               | **Fourni le 23 septembre**, dans `lib/reseaux.ts`    |

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

Le **lien d'invitation est fourni depuis le 23 septembre 2026** et vit dans
`apps/web/src/lib/reseaux.ts`, avec les trois comptes publics de la marque. Il n'est plus une
variable d'environnement : il était déclaré dans `.env.example` et dans cette liste depuis le
13 septembre, mais **aucun code ne le lisait** — une valeur réclamée au client pour rien.

Il débloque deux choses : les icônes de communauté du pied de page, et la relance de quelqu'un
qui a lié son compte sans jamais rejoindre le serveur — une relance qui ne dit pas où aller ne
sert à rien.

**Une seule chose à vérifier côté Discord** : que cette invitation soit **permanente, sans
expiration ni limite d'usage**. Une invitation qui périme transforme la relance en impasse, et
personne ne s'en aperçoit avant la première plainte.

### Supabase — la clé serveur — **fournie**

`SUPABASE_SERVICE_ROLE_KEY` est renseignée depuis le 12 septembre 2026 et lit bien la base
hébergée. Elle reste à reporter sur l'hébergement du site et sur celui du worker le jour où
ils existent.

**Sans elle** : le formulaire de qualification ne crée ni compte ni prospect. Le tunnel ne
démarre pas du tout.

### Whop

**Whop remplace Stripe depuis le 23 septembre 2026.** Le compte du client est actif ; ce qui
manque, ce sont les clés et trois réglages.

| À fournir             | Variable              | Où le trouver                 |
| --------------------- | --------------------- | ----------------------------- |
| Clé d'API             | `WHOP_API_KEY`        | Dashboard → Developer         |
| Identifiant du compte | `WHOP_ACCOUNT_ID`     | Dashboard → Settings, `biz_…` |
| Secret du webhook     | `WHOP_WEBHOOK_SECRET` | Developer → Webhooks, `ws_…`  |

Le secret se recopie **tel quel, préfixe compris** : contrairement à la spécification d'origine
des « Standard Webhooks », Whop demande de ne pas le décoder. Un secret amputé de son préfixe
fait échouer toutes les signatures, et le webhook répond 401 sans que rien n'explique pourquoi.

Le webhook doit pointer vers `https://<le-site>/api/whop`, et écouter ces événements :
`payment.succeeded`, `payment.failed`, `membership.deactivated`,
`membership.cancel_at_period_end_changed`, `refund.created`, `refund.updated`,
`dispute.created`, `dispute.updated`. Un événement oublié dans cette liste est un événement que
le site n'apprendra jamais — un litige, par exemple.

**Sans elles** : aucun paiement ne s'ouvre, aucun encaissement n'est reçu, aucun remboursement
ne s'exécute.

#### Trois choses à vérifier dans le bac à sable avant d'ouvrir les ventes

Elles ne coûtent qu'une heure, et ce sont les seules zones du chemin de l'argent écrites d'après
la documentation sans avoir jamais tourné.

1. **La clé d'idempotence des remboursements.** Stripe garantissait par contrat qu'un appel
   rejoué renvoie le même remboursement. La documentation de Whop mentionne cette clé dans un
   exemple de SDK mais pas dans son schéma : on l'envoie sans pouvoir s'y fier. **C'est le seul
   risque de la bascule qui coûte de l'argent réel** — deux clics simultanés sur « Exécuter »
   pourraient rembourser deux fois. Se vérifie en appelant deux fois de suite.
2. **Le paramètre de résiliation.** `POST /memberships/{id}/cancel` gère la résiliation
   différée et la résiliation immédiate par un paramètre que la documentation ne nomme pas. À
   noter tout de suite : **même si Whop se trompait et éteignait l'adhésion sur-le-champ, le
   client ne perdrait rien** — l'accès du site et le rôle Discord suivent
   `inscriptions.date_fin_acces`, pas l'état chez le prestataire.
3. **La forme des montants.** Whop parle en décimales (`"290.00"`) là où tout le modèle est en
   centimes entiers, et les montants d'un paiement sont des objets dont la documentation ne
   donne pas la clé exacte. `lib/paiement/montants-whop.ts` accepte les formes connues et rend
   `null` pour le reste — jamais un zéro inventé. Un encaissement qui atterrit dans la file de
   rattrapage avec « Montant illisible » veut dire que la forme réelle est encore une autre.

#### Le mode fiscal, qui est une question pour le juriste

Whop propose trois modes. **Le choix retenu le 23 septembre est « Whop collecte et reverse »
(2 %)** : c'est le seul qui n'oblige pas APEX COMPANY, société de Dubaï vendant du service
numérique à des consommateurs de l'Union, à s'immatriculer elle-même au guichet unique non-Union
et à déposer les déclarations. Le mode à 0 % n'est moins cher que si quelqu'un fait ce travail.

**Il a une conséquence qui n'est pas réglée** : dans ce mode, Whop devient _merchant of record_
et c'est lui qui émet la facture fiscale, alors que les mentions légales, les CGV et la page
remboursement — écrites le 21 septembre, jamais relues par un juriste — désignent APEX COMPANY
comme vendeur et émetteur. `/facture/[id]` continue de produire un document juste sur le fond
(qui a acheté quoi, à quel prix) mais son en-tête n'est pas celui d'une facture fiscale.

**À faire relire avec cette réponse en main.** C'est le même juriste que celui déjà attendu, et
la question s'ajoute à sa liste plutôt que d'en ouvrir une nouvelle.

Le code, lui, ne parie sur aucun mode : il écrit la TVA que Whop rapporte, et `null` quand il
n'en rapporte pas. Une TVA non calculée n'est jamais écrite comme une TVA nulle.

#### Les identifiants de rôle Discord des neuf produits

Ils ne dépendent pas de Whop, mais c'est ici qu'on s'en aperçoit : **encaisser sans pouvoir
ouvrir l'accès est exactement ce que la base refuse.** Un produit actif sans `discord_role_id`
est impossible, et c'est voulu. Un rôle par produit, à créer sur le serveur puis à saisir dans
`/admin/formations` — **la liste des neuf est en section 3.**

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

`RESEND_API_KEY`, `EMAIL_FROM` et `RESEND_WEBHOOK_SECRET`, ou l'équivalent configuré côté
Supabase.

**Les emails automatiques du site** (paiement reçu, proposition, relances) partent par Resend
directement, depuis une tâche horaire. Sans ces variables, rien ne part — et le domaine de
`EMAIL_FROM` doit être vérifié chez Resend (trois enregistrements DNS), sans quoi Resend refuse.

#### Les quatre enregistrements DNS — et où ils se créent

**Tous les quatre se créent chez le fournisseur du nom de domaine** (ou chez celui qui héberge
la zone DNS, si les serveurs de noms ont été délégués — Cloudflare, par exemple). **Aucun ne se
crée chez Resend.** Resend se contente d'afficher les trois premiers, puis de vérifier leur
présence ; c'est la confusion la plus fréquente sur ce sujet, et elle fait perdre une heure.

| Enregistrement                         | Qui le dicte     | À quoi il sert                                      |
| -------------------------------------- | ---------------- | --------------------------------------------------- |
| SPF                                    | Resend l'affiche | Autorise Resend à écrire au nom du domaine          |
| DKIM                                   | Resend l'affiche | Signe chaque email, prouve qu'il n'a pas été altéré |
| Return-Path (MX + SPF du sous-domaine) | Resend l'affiche | Reçoit les rebonds                                  |
| **DMARC**                              | **à nous**       | Dit aux boîtes quoi faire si SPF et DKIM échouent   |

**DMARC est le seul que Resend ne réclame pas, et le seul dont l'absence ne se voit nulle
part** : le tableau de bord Resend affichera « domaine vérifié » sans lui, et les emails
partiront. Ils seront simplement filtrés plus souvent. Depuis les règles communes de Gmail et
Yahoo entrées en vigueur en 2024, un domaine expéditeur sans enregistrement DMARC se fait
classer en indésirable, voire rejeter — y compris pour du transactionnel.

C'est un enregistrement `TXT` sur le nom `_dmarc.<le-domaine>`. Commencer en observation, le
temps de vérifier que rien de légitime n'est pris au passage :

```
v=DMARC1; p=none; rua=mailto:dmarc@<le-domaine>
```

Puis, une fois les rapports lus et le trafic légitime identifié, resserrer en
`p=quarantine`. **Ne pas poser `p=reject` d'emblée** : si un email légitime part encore
d'ailleurs (l'ancien site, un outil de facturation, une boîte pro), il disparaît sans trace.

#### Le webhook des réceptions — `RESEND_WEBHOOK_SECRET`

**À faire une fois le compte Resend créé**, dans _Webhooks → Add Webhook_ :

1. URL : `https://<le-site>/api/resend`.
2. Événements à cocher : `email.delivered`, `email.bounced`, `email.complained`. Les autres
   sont ignorés par la route, inutile de les activer.
3. Copier le secret affiché (`whsec_...`) dans `RESEND_WEBHOOK_SECRET`.

**Sans lui, les emails partent mais on ne sait jamais s'ils arrivent.** Le registre s'arrête à
`envoye`, qui veut seulement dire « Resend a accepté la requête » : une adresse morte, une
boîte pleine ou un client qui clique sur « indésirable » restent invisibles, et `/admin/emails`
affiche « Envoyé » pour un email que personne n'a reçu — c'est pourtant la page qu'on ouvre
quand quelqu'un dit n'avoir rien reçu. La page le dit elle-même tant que la variable manque.

Le cas le plus grave est celui des **emails de connexion** : ils partent par le SMTP de
Supabase et n'ont pas de ligne au registre, mais leurs rebonds arrivent quand même sur ce
webhook, qui les consigne dans `/admin/logs`. Depuis le 17 septembre un client n'a pas de mot
de passe — si son lien de connexion rebondit, il est dehors, et rien d'autre ne le signalerait.

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

**Cinq pages légales sur six sont rédigées depuis le 21 septembre 2026**, à partir des textes
de l'ancien site (apexcompany.com, mis à jour le 4 mai 2026) transmis par le client : mentions
légales, CGV, avertissement sur les risques (ancien « disclaimer » fusionné avec l'annexe
« Risk Disclosure » des CGV, `/disclaimer` y redirige), rétractation et remboursement,
confidentialité, cookies. Seule `/accessibilite` reste en attente — il faut un audit.

**Qui vend est tranché : APEX COMPANY L.L.C-FZ**, Meydan Free Zone, Dubaï — licence
2645781.01, immatriculation 2645781, TRN 105376842800001, gérant Franck Alexandre. Les
textes de l'ancien site la désignent partout comme vendeur et émettrice des factures ;
NEURO TRADE APEX LLC n'y apparaît jamais. Toutes ces valeurs vivent dans
`apps/web/src/lib/legal/societe.ts`, et nulle part ailleurs. **La licence expire le
19 février 2027** : à renouveler, puis à mettre à jour dans ce fichier.

**Ces textes n'ont été relus par aucun juriste.** Ils reprennent ceux du client, et ne s'en
écartent que là où l'ancien texte était faux pour ce site. `/admin/legal` liste ces écarts
page par page ; les principaux :

| Ancien texte                                                          | Nouveau                                                                                               | Pourquoi                                                                                                                                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rétractation éteinte « dès activation » pour tout                     | Éteinte à l'accès pour une **formation** et un **abonnement** ; **au prorata** pour un accompagnement | Un suivi par un formateur est un service : commencé à la demande du client, il reste rétractable, la part fournie restant due. Un abonnement se résilie et ne se rembourse pas (décidé le 22/09). |
| « En cochant la case dédiée »                                         | **Deux cases** avant chaque paiement, acceptation enregistrée                                         | Aucun parcours de paiement n'en présentait : acceptation des CGV et renonciation étaient impossibles à prouver.                                                                                   |
| Plateforme européenne RLL (ec.europa.eu/consumers/odr)                | Retirée ; médiateur de la consommation                                                                | La plateforme a fermé le 20 juillet 2025.                                                                                                                                                         |
| Responsabilité plafonnée au montant payé                              | Plafond retiré                                                                                        | Présumé abusif face à un consommateur (droit français).                                                                                                                                           |
| Six catégories (outils logiciels, agents automatisés, certification…) | Trois produits : abonnement, accompagnement, formation                                                | Seuls ceux-là sont vendus sur ce site.                                                                                                                                                            |
| Résiliation par email                                                 | Depuis l'espace client, ou par email                                                                  | C'est ce que le site fait.                                                                                                                                                                        |
| Whop, TAP Payments, Circle, Zoom, Brevo, Google Workspace, Netlify    | Supabase, Vercel, Whop, Discord, Cal.com, Resend                                                      | Les sous-traitants réellement branchés.                                                                                                                                                           |
| Cookies de mesure d'audience et marketing « lorsque applicable »      | Aucun traceur, cookies de session seulement                                                           | Vérifiable dans le code.                                                                                                                                                                          |
| Objet : « psychologie personnelle, stabilité intérieure »             | Formation au trading, exclusivement éducative                                                         | L'ancien texte décrivait une autre activité que celle vendue — et que ses propres CGV.                                                                                                            |
| Pas de formulaire de rétractation                                     | Formulaire type sur `/remboursement`                                                                  | Le vendeur doit le mettre à disposition.                                                                                                                                                          |

L'email « Paiement reçu » confirme désormais par écrit la demande de démarrage immédiat et ce
qu'elle change pour la rétractation, et porte l'identité du vendeur en pied.

**L'adresse des demandes juridiques est `payment@apexcompany.com`**, celle que les textes de
l'ancien site donnent pour tout. `contact@apexcompany.com` (page contact) n'est toujours pas
confirmée.

### Ce qu'il reste à obtenir, avant la première vente

| Question                                                        | Pourquoi                                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Relecture des cinq textes par un juriste**                    | Ils engagent la société dès la mise en ligne                                                          |
| **Médiateur de la consommation retenu**                         | Obligatoire pour vendre à des consommateurs français ; les CGV promettent ses coordonnées sur demande |
| **Représentant dans l'Union (article 27 RGPD)**                 | Exigé d'un responsable établi hors Union qui cible des résidents européens. Aucun n'est désigné       |
| Hébergeur du site confirmé                                      | Les mentions légales nomment Vercel, recommandé mais pas souscrit                                     |
| « Organisme de formation » sur l'accueil                        | Appellation encadrée en France (déclaration d'activité) — à garder ou à reformuler                    |
| Dix ans de conservation comptable                               | Repris de l'ancien texte ; le droit émirien en demande cinq, dix couvre les deux                      |
| Trois ans pour un prospect inactif (CNIL) : le juriste valide ? | Tranché par défaut le 16/09 ; la purge est écrite                                                     |

### Ce que les textes promettent et que le code ne fait pas encore

Du travail de développeur, noté dans `09-CHANTIERS.md`, à faire avant d'ouvrir les ventes :

- **Les factures** — faites le 22 septembre : `/facture/[id]`, générée à la demande depuis la
  base, imprimable et enregistrable en PDF, ouverte depuis l'espace client et le back-office.
  **Leur TVA est celle que Whop rapporte** avec chaque encaissement (repris le 23 septembre du
  calcul de Stripe Tax). Le mode fiscal retenu — « Whop collecte et reverse », 2 % — fait de
  Whop le vendeur apparent sur la facture fiscale : notre facture reste juste sur le fond (qui
  a acheté quoi, à quel prix), mais son en-tête n'est pas celui d'une facture fiscale. **C'est
  la question à poser au juriste en même temps que la relecture.** Le mode se choisit dans le
  tableau de bord Whop (`10-MISE-EN-PRODUCTION.md` §7).
- **La conservation des clients** : « trois ans après le dernier achat ou contact », écrit dans
  la politique de confidentialité, n'est appliqué par rien. La purge ne touche que les
  prospects.
- **La rétractation d'un accompagnement** fonctionne : la fiche client calcule le montant et
  pré-remplit la demande, et un remboursement lancé depuis le back-office referme l'accès,
  même partiel. (Seul un remboursement partiel fait directement dans Whop laisse l'accès
  ouvert — c'est voulu, pour un geste commercial.)

---

## 3. Contenu

Rien de tout cela n'a été inventé, et rien ne le sera : une biographie ou un témoignage
fabriqué sur un site de formation en investissement est un risque, pas un espace réservé.

### Les neuf produits sont en vente — sur l'environnement de développement

**Le catalogue réel est en base depuis le 23 septembre**, tiré du document de seize liens de
paiement transmis par le client : les neuf produits ci-dessous, avec leur prix, leur durée
d'accès et leur plan Whop.

**Le 24 septembre, les rôles Discord ont été créés et les neuf publiés.** Ce manque-là est
donc levé, et les trois produits du jeu d'essai sont sortis de la vente. `/formations` montre
le vrai catalogue, APEX PRIME à 59 € par mois et 490 € par an.

**Ce qui reste vrai pour la production** : les identifiants de rôle ne valent que sur le
serveur Discord où ils ont été créés. Le jour de la mise en ligne, il faudra les recréer sur
le serveur de production et les réinscrire — c'est l'affaire d'une commande
(`npm run discord:roles`), pas d'une ressaisie.

**Un produit publié doit déclarer son rôle Discord**, et c'est voulu : sans lui, il encaisse
un paiement, ouvre une commande, une inscription et une facture — et n'ouvre aucun accès. Le
back-office le refuse depuis le 13 septembre ; **la base le refuse depuis le 24**
(`20260924100000_a_publication_avec_role.sql`), parce qu'une règle qui ne vit que dans un
écran ne tient pas un `update` fait ailleurs.

**Il n'y a rien à nous envoyer produit par produit.** Un identifiant de rôle est un nombre que
Discord attribue au moment où le rôle est créé — il ne s'invente pas, et le recopier neuf fois
à la main se paie d'une faute de frappe qui ne se verrait qu'au premier paiement. **Il suffit
de l'accès administrateur au serveur** : `npm run discord:roles` crée les rôles manquants,
sans aucune permission, et écrit leur identifiant dans chaque fiche produit.

**Ce qui reste humain, et qui n'est pas fait** : ouvrir les salons à ces rôles. Un rôle sans
permission n'ouvre rien tant qu'aucun salon ne le reconnaît — un client paierait, recevrait
son rôle, et ne verrait aucun salon nouveau.

| Produit                         | Prix        | Ce qu'un paiement ouvre | Rôle Discord   |
| ------------------------------- | ----------- | ----------------------- | -------------- |
| APEX PRIME                      | 59 € / mois | 30 jours, renouvelés    | « APEX PRIME » |
| APEX PRIME — annuel             | 490 € / an  | 365 jours, renouvelés   | le même        |
| PALACE 1                        | 290 €       | 30 jours                | —              |
| PALACE 2                        | 890 €       | 60 jours                | —              |
| PALACE 3                        | 1 600 €     | 90 jours                | —              |
| MATRIX 3.0                      | 4 500 €     | 180 jours               | —              |
| APEX BLACK                      | 4 800 €     | accès illimité          | —              |
| APEX PARTNER                    | 5 500 €     | accès illimité          | —              |
| APEX PARTNER — 6 mois lancement | 4 500 €     | 180 jours               | —              |

**Le nom du rôle n'a pas à être recopié au caractère près** : `APEX_PRIME`, `APEX PRIME` et
`apex-prime` sont reconnus comme le même rôle — tirets, underscores et espaces sont ramenés à
un seul séparateur. Ce qui distingue deux rôles, ce sont les mots : `PALACE 1` et `PALACE 2`
restent deux rôles.

**Huit rôles pour neuf produits** : APEX PRIME se vend au mois et à l'année, mais c'est le même
accès — deux rôles donneraient deux salons pour la même chose. Le partage est sans danger, et
pas par chance : la révocation en fin d'accès vérifie, avant chaque retrait, qu'aucune **autre
inscription active du même client** ne porte ce rôle. L'abonné annuel ne perd donc rien quand
son mensuel expire.

**Une question à poser au client** : APEX PARTNER et sa formule lancement donnent-ils accès aux
mêmes salons ? On suppose que non — deux produits, deux rôles. Les réunir plus tard est une
ligne à changer ; les séparer après coup demande de reprendre les membres un par un.

Ce qui reste à fournir ensuite, produit par produit — ça ne bloque pas la vente, ça vide les
fiches : description longue, objectifs pédagogiques, prérequis. Tout se saisit dans
`/admin/formations`, sans SQL.

#### Deux choses à trancher avec le client

- **Les trois produits de démonstration sont encore les seuls publiés** sur la base de
  développement — « Communauté », « Accélérateur », « Fondations » —, au dernier état connu du
  dépôt. Ils viennent du jeu de données de test, pas du client. Le jour de la mise en ligne, ce sont eux qu'il faut retirer et
  les neuf vrais qu'il faut publier — sans quoi le site vend des produits qui n'existent pas.
- **Sept des seize liens ne sont pas au catalogue** et continuent de se vendre par leur lien
  Whop : les trois variantes « en 2 fois » (PALACE 2, PALACE 3, APEX BLACK), l'acompte de
  réservation de 150 €, et les trois formules d'APEX MASTERY — le séminaire de Toulouse des 23
  et 24 octobre. Chacune demande du développement, détaillé en tête de
  `20260923120000_a_catalogue_septembre.sql` ; APEX MASTERY est hors périmètre depuis le
  23 septembre — pas de réservation de place sur le site, la billetterie reste externe. **Leurs encaissements
  arrivent sans aucune métadonnée** et tombent dans `/admin/paiements/rattrapage`, où quelqu'un
  les rattache à la main, un par un. La question à poser : continue-t-on à vendre ainsi, ou
  retire-t-on ces liens ?

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
| **Le logo**, en fichier vectoriel si possible       | La charte est arrivée le 23/09, le logo non : le site affiche le nom en texte  |
| Une preuve sociale externe, si elle existe          | Type Trustpilot — c'est ce qui porte la crédibilité chez le concurrent cité    |
| Photos ou visuels de la marque                      | Les fiches produit et l'accueil n'ont aucune image aujourd'hui                 |
| Le contenu de tous les emails envoyés               | Clients et formateurs — voir ci-dessous                                        |

**Ce qui est arrivé le 23 septembre et qu'il ne faut plus redemander** : la charte graphique
(une bannière, dont les couleurs du site sont échantillonnées), le lien d'invitation Discord et
les trois comptes de la marque. L'image qui s'affiche quand un lien du site est partagé en
découle et est faite — elle attendait cette charte depuis le 9 septembre.

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
vend, adresse de contact) et, côté formateur, **la liste des notifications voulues**. Le
pied d'email porte l'identité du vendeur depuis le 21 septembre.

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

## 3 bis. Les clients qui existent déjà

**Le client vend depuis des mois, par ses seize liens de paiement.** Ces acheteurs-là ont un
accès, un rôle Discord posé à la main, et pour certains un abonnement qui se prélève tous les
mois. **La plateforme ne connaît aucun d'eux** : pas de compte, pas d'inscription, pas de date
de fin d'accès, pas de facture.

Le jour de la mise en ligne, ça se voit de deux façons, et les deux sont mauvaises :

- **ils n'ont pas d'espace client.** Ils se connectent, et le site leur dit qu'ils n'ont aucun
  accès en cours — alors qu'ils paient ;
- **si on leur demande de reprendre un abonnement sur le site, ils paient deux fois**, puisque
  leur adhésion Whop continue de se prélever de son côté.

**Ce n'est pas une question de développement**, ou pas d'abord : personne ici ne sait ce qui
existe. Ce qu'il faut du client, en une seule fois :

| À fournir                                         | Pourquoi                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| La liste des clients actifs                       | Nom, adresse email — c'est la clé qui relie tout le reste                   |
| Ce que chacun a acheté                            | Pour retrouver le produit au catalogue                                      |
| Depuis quand, et jusqu'à quand                    | Sans date de fin, la révocation automatique ne sait pas quoi faire          |
| Ceux qui ont un abonnement en cours               | Ce sont les seuls qui risquent le double prélèvement                        |
| Leur compte Discord, si le client le connaît      | Sinon chacun devra relier le sien lui-même, ce qui est une relance à écrire |
| Ce qui existe ailleurs (Circle, groupe, tableur…) | Pour ne pas découvrir une deuxième liste après la bascule                   |

**Un export Whop des adhésions actives couvre la plus grosse part**, et c'est le plus simple à
demander.

### Deux points à trancher, et le second est pour le juriste

- **Les abonnements en cours restent prélevés par Whop**, et c'est une bonne nouvelle : le
  prestataire ne change pas, donc il n'y a rien à re-souscrire. Le site n'a qu'à enregistrer
  l'accès. Reste à vérifier, adhésion par adhésion, que le plan acheté correspond bien à un
  produit du catalogue.
- **Ces clients n'ont aucune acceptation des CGV enregistrée.** La règle posée le 21 septembre
  est « pas de preuve, pas de vente », et c'est elle qui interdit déjà d'ouvrir un accès sur une
  ressemblance dans la file de rattrapage. Importer un client existant, c'est ouvrir un accès
  sans cette preuve. **C'est une question pour le juriste**, à poser avec la relecture : un
  achat antérieur au site n'a pas été conclu sous ces CGV, et il faut savoir ce qui vaut
  acceptation pour lui.

**Rien n'est écrit pour cette reprise** — c'est la phase 8 de `06-PERIMETRE.md`, et elle ne peut
pas commencer avant d'avoir la liste. Elle est courte si les données sont propres, longue si
elles sont à reconstituer de mémoire.

---

## 4. Décisions en attente

**Aucune ne reste ouverte côté produit** depuis le 16 septembre 2026 : vidéos exclusives sur
une plateforme externe (hors projet), vouvoiement, pas de PayPal en v1, pas de Supabase Pro
pour le développement, salons Discord par défaut, prospects conservés trois ans. Détail et
raisons dans `CLAUDE.md`. Le vendeur est tranché le 21 septembre (APEX COMPANY L.L.C-FZ), et le
23 septembre a tranché le prestataire de paiement (Whop, en remplacement de Stripe), la TVA
(mode « Whop collecte et reverse », 2 %) et les événements (pas de réservation de place sur le
site). **Une seule décision de ces trois engage au-delà du code** : le mode fiscal, parce qu'il
fait de Whop le vendeur apparent sur la facture (section 2).

---

## 4 bis. Abonnements à la charge du client

Ordres de grandeur relevés le 16 septembre 2026, **à vérifier au moment de souscrire** — les
grilles changent. Les comptes sont ouverts **au nom du client**, qui les paie ; les
développeurs y sont invités.

| Service                         | Pour quoi                                              | Coût                                                                                                                             |
| ------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Nom de domaine                  | L'adresse du site                                      | ~10–20 € par an — **`apexcompany.com` existe déjà** (ancien site) : est-ce ce domaine, et qui le contrôle ?                      |
| Vercel (plan Pro)               | Héberger le site et la tâche quotidienne de révocation | ~20 $ par mois — le plan gratuit exclut l'usage commercial                                                                       |
| Railway ou équivalent           | Faire tourner le bot Discord en continu                | ~5 $ par mois                                                                                                                    |
| Supabase (plan Pro, production) | Base de données, comptes, **sauvegardes quotidiennes** | 25 $ par mois — recommandé dès l'ouverture des ventes                                                                            |
| Whop                            | Encaisser les paiements — **compte déjà ouvert**       | Pas d'abonnement ; commission par paiement, **+ 2 %** pour le mode fiscal retenu. Le taux exact est celui du compte : à relever. |
| Resend ou équivalent            | Emails de confirmation — **sans eux, aucun paiement**  | Gratuit au départ, ~20 $ par mois au-delà du quota                                                                               |
| Cal.com                         | Prise de rendez-vous de l'audit                        | Gratuit, ou ~12 $ par mois si les webhooks sont payants                                                                          |
| Discord                         | Communauté et accès des clients                        | Gratuit                                                                                                                          |
| Boîtes email professionnelles   | Contact et demandes RGPD, si elles n'existent pas déjà | ~6–8 € par mois par boîte                                                                                                        |
| Médiateur de la consommation    | Obligation légale de vente aux particuliers            | Adhésion, souvent annuelle                                                                                                       |

Hors de cette liste : la plateforme des vidéos exclusives, hors projet, et le conseil
juridique, qui est une dépense ponctuelle.

**Le nom de domaine est le premier de la liste par ordre d'urgence, et pas par son prix.** Il
bloque quatre choses à la fois : l'envoi des emails (les enregistrements DNS se posent chez son
fournisseur, et ils mettent quelques heures à se propager), l'adresse du webhook Whop,
l'indexation du site — `robots.txt` interdit tout tant que le site n'est pas servi en HTTPS
depuis son vrai domaine — et les mentions légales, qui nomment l'hébergeur. **S'il s'agit de
reprendre `apexcompany.com`, l'ancien site disparaît le jour de la bascule** : c'est une
décision, pas une formalité.

---

## 5. Dans quel ordre

1. **La clé serveur Supabase.** Une minute, et sans elle rien ne démarre.
2. **Discord.** Le plus long à mettre en place, et le plus bloquant.
3. **Les neuf rôles Discord du catalogue**, un par produit. Le catalogue lui-même est en base
   depuis le 23 septembre ; sans les rôles, aucun produit ne peut être mis en vente.
4. **Le nom de domaine**, et la décision sur `apexcompany.com`. Il commande les emails,
   l'adresse du webhook, l'indexation et les mentions légales, et les enregistrements DNS
   mettent quelques heures à se propager : le demander tard fait attendre tout le reste.
5. **Cal.com**, avec la vérification des webhooks.
6. **Whop** — les trois clés, la liste d'événements du webhook, le mode fiscal —, puis un vrai
   parcours d'achat de bout en bout dans le bac à sable. **C'est le test qui compte, et c'est
   une heure** : rien du chemin de l'argent n'a jamais tourné contre le vrai service.
7. **La liste des clients déjà actifs**, qui peut être demandée dès maintenant : elle ne bloque
   rien tant que le site n'est pas ouvert, mais elle est longue à reconstituer si personne ne
   l'a sous la main (section 3 bis).
8. **L'envoi d'emails**, à vérifier avant d'ouvrir les ventes, sous peine de les bloquer toutes.
   Les quatre enregistrements DNS **dès que le domaine existe**, sans attendre le reste : ils se
   propagent en quelques heures, et DMARC gagne à rester en observation quelques jours avant
   d'être resserré.
9. **Le planificateur** de la révocation quotidienne.
10. **Le juridique**, en parallèle et sans attendre : c'est ce qui a le plus long délai.

---

## 6. Récapitulatif à remplir

À compléter avec le chef de projet. Remplacer les `—` par la réponse, ou par « fourni le
JJ/MM » pour une clé — **jamais par la clé elle-même**.

### Accès techniques

| Élément                                | État                                 | Qui s'en occupe | Note                       |
| -------------------------------------- | ------------------------------------ | --------------- | -------------------------- |
| Clé serveur Supabase                   | fournie le 12/09                     | —               | —                          |
| Serveur Discord créé                   | —                                    | —               | —                          |
| Application et bot Discord             | —                                    | —               | —                          |
| Rôle `invité` créé                     | créé le 24/09                        | Anthony         | Bot au-dessus : à vérifier |
| Fournisseur Discord activé (Supabase)  | —                                    | —               | —                          |
| Compte Cal.com de Franck               | —                                    | —               | —                          |
| Webhooks Cal.com disponibles ?         | —                                    | —               | —                          |
| Clés Whop (API, compte, webhook)       | —                                    | —               | —                          |
| Webhook Whop créé, 8 événements cochés | —                                    | —               | —                          |
| Mode fiscal Whop choisi                | « collecte et reverse » (2 %), 23/09 | —               | —                          |
| **Les 9 rôles Discord des produits**   | créés le 24/09 (serveur de dev)      | Anthony         | À recréer en production    |
| Envoi d'emails configuré               | —                                    | —               | —                          |
| SPF, DKIM, Return-Path posés           | —                                    | —               | —                          |
| **DMARC posé** (`_dmarc.<domaine>`)    | —                                    | —               | —                          |
| Webhook Resend et son secret           | —                                    | —               | —                          |
| Planificateur de la révocation         | —                                    | —               | —                          |
| Nom de domaine et hébergement du site  | —                                    | —               | —                          |

### Abonnements à souscrire

Les coûts et ce qu'ils achètent sont en section 4 bis. Ici, seulement où ça en est.

| Service                             | Ouvert ? | Au nom de qui | Coût constaté |
| ----------------------------------- | -------- | ------------- | ------------- |
| Nom de domaine                      | —        | —             | —             |
| Vercel (plan Pro)                   | —        | —             | —             |
| Railway (ou équivalent) pour le bot | —        | —             | —             |
| Supabase (plan Pro, production)     | —        | —             | —             |
| Whop                                | oui      | le client     | —             |
| Resend (ou équivalent)              | —        | —             | —             |
| Cal.com                             | —        | —             | —             |
| Boîtes email professionnelles       | —        | —             | —             |
| Médiateur de la consommation        | —        | —             | —             |

### Juridique

| Question                                  | Réponse                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| Société qui vend aux clients finaux       | APEX COMPANY L.L.C-FZ (textes de l'ancien site, 21/09)                    |
| Numéro d'immatriculation de cette société | 2645781 — licence 2645781.01, **expire le 19/02/2027**                    |
| Adresse du siège                          | Meydan Grandstand, 6th Floor, Meydan Road, Nad Al Sheba, Dubaï            |
| Directeur de la publication               | Franck Alexandre                                                          |
| Hébergeur du site — nom et adresse        | Vercel indiqué dans les mentions ; à confirmer à la souscription          |
| Adresse de contact                        | —                                                                         |
| Adresse pour les demandes RGPD            | payment@apexcompany.com (textes de l'ancien site)                         |
| Médiateur de la consommation              | —                                                                         |
| Régime de TVA retenu                      | Whop collecte et reverse, 2 % (23/09) — Whop devient _merchant of record_ |
| Facture fiscale : Whop ou APEX COMPANY ?  | À trancher avec le juriste : les CGV disent APEX COMPANY                  |
| Représentant dans l'Union (RGPD)          | —                                                                         |
| Conseil juridique consulté ?              | —                                                                         |

### Contenu

| Élément                                  | État                         | Note                                         |
| ---------------------------------------- | ---------------------------- | -------------------------------------------- |
| Catalogue réel en base                   | **en vente depuis le 24/09** | Les 3 produits du jeu d'essai sont dépubliés |
| Biographies et photos des formateurs     | —                            | —                                            |
| Témoignages, avec accord écrit           | —                            | —                                            |
| Chiffres de réassurance validés et datés | —                            | —                                            |
| Logo                                     | —                            | —                                            |
| Visuels et photos de la marque           | —                            | —                                            |
| Charte graphique                         | fournie le 23/09 (bannière)  | Le site est repeint avec                     |
| Preuve sociale externe (type Trustpilot) | —                            | —                                            |
| Textes des emails automatiques           | —                            | Brouillons à relire, section 3               |
| Descriptions longues des 9 produits      | —                            | Objectifs, prérequis                         |
| Liste des clients déjà actifs            | —                            | Export Whop des adhésions, section 3 bis     |

### Décisions

| Question                                   | Réponse                                             |
| ------------------------------------------ | --------------------------------------------------- |
| Où vivent les vidéos exclusives ?          | Plateforme externe, hors projet (16/09)             |
| Plan Supabase Pro — 25 $/mois              | Pas besoin pour le dev (16/09) ; recommandé en prod |
| Second prestataire de paiement (PayPal) ?  | Pas en v1 (16/09)                                   |
| Tutoiement ou vouvoiement                  | Vouvoiement (16/09)                                 |
| Prestataire de paiement                    | Whop, en remplacement de Stripe (23/09)             |
| Événements et séminaires sur le site ?     | Non — billetterie externe (23/09)                   |
| Les 7 liens hors catalogue : on continue ? | —                                                   |
| `apexcompany.com` devient le site ?        | —                                                   |
