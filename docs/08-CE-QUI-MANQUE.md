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

Le webhook doit pointer vers `https://<le-site>/api/stripe`, et écouter ces événements :
`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
`customer.subscription.deleted`, `charge.dispute.created`, `charge.dispute.updated`,
`charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`,
`refund.created`, `refund.updated`, `refund.failed`. Un événement oublié dans cette liste est un
événement que le site n'apprendra jamais — un litige, par exemple.

**Le portail client Stripe doit être enregistré une fois** (_Paramètres → Facturation → Portail
client_, bouton « Enregistrer »), en y autorisant la mise à jour du moyen de paiement. C'est lui
qui s'ouvre quand un abonné en échec de prélèvement clique « Mettre à jour ma carte » : sans
cette configuration, le bouton affiche une erreur.

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
| Whop, TAP Payments, Circle, Zoom, Brevo, Google Workspace, Netlify    | Supabase, Vercel, Stripe, Discord, Cal.com, Resend                                                    | Les sous-traitants réellement branchés.                                                                                                                                                           |
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
| **Régime de TVA dans l'Union**                                  | Les prix sont affichés TTC ; reste à savoir quelle TVA ils contiennent (guichet unique non-Union ?)   |
| **Représentant dans l'Union (article 27 RGPD)**                 | Exigé d'un responsable établi hors Union qui cible des résidents européens. Aucun n'est désigné       |
| Hébergeur du site confirmé                                      | Les mentions légales nomment Vercel, recommandé mais pas souscrit                                     |
| « Organisme de formation » sur l'accueil                        | Appellation encadrée en France (déclaration d'activité) — à garder ou à reformuler                    |
| Dix ans de conservation comptable                               | Repris de l'ancien texte ; le droit émirien en demande cinq, dix couvre les deux                      |
| Trois ans pour un prospect inactif (CNIL) : le juriste valide ? | Tranché par défaut le 16/09 ; la purge est écrite                                                     |

### Ce que les textes promettent et que le code ne fait pas encore

Du travail de développeur, noté dans `09-CHANTIERS.md`, à faire avant d'ouvrir les ventes :

- **Les factures PDF.** Les CGV disent qu'une facture est émise et disponible dans l'espace ;
  la ligne existe, le PDF non. L'identité du vendeur est connue, le taux de TVA à y porter ne
  l'est pas.
- **La conservation des clients** : « trois ans après le dernier achat ou contact », écrit dans
  la politique de confidentialité, n'est appliqué par rien. La purge ne touche que les
  prospects.
- **La rétractation d'un accompagnement au prorata** est un remboursement partiel, et un
  remboursement partiel laisse l'accès ouvert : il faut le fermer à la main.

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
   Les quatre enregistrements DNS **dès que le domaine existe**, sans attendre le reste : ils se
   propagent en quelques heures, et DMARC gagne à rester en observation quelques jours avant
   d'être resserré.
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
| SPF, DKIM, Return-Path posés          | —                | —               | —    |
| **DMARC posé** (`_dmarc.<domaine>`)   | —                | —               | —    |
| Webhook Resend et son secret          | —                | —               | —    |
| Planificateur de la révocation        | —                | —               | —    |
| Nom de domaine et hébergement du site | —                | —               | —    |

### Juridique

| Question                                  | Réponse                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| Société qui vend aux clients finaux       | APEX COMPANY L.L.C-FZ (textes de l'ancien site, 21/09)           |
| Numéro d'immatriculation de cette société | 2645781 — licence 2645781.01, **expire le 19/02/2027**           |
| Adresse du siège                          | Meydan Grandstand, 6th Floor, Meydan Road, Nad Al Sheba, Dubaï   |
| Directeur de la publication               | Franck Alexandre                                                 |
| Hébergeur du site — nom et adresse        | Vercel indiqué dans les mentions ; à confirmer à la souscription |
| Adresse de contact                        | —                                                                |
| Adresse pour les demandes RGPD            | payment@apexcompany.com (textes de l'ancien site)                |
| Médiateur de la consommation              | —                                                                |
| Régime de TVA retenu                      | —                                                                |
| Représentant dans l'Union (RGPD)          | —                                                                |
| Conseil juridique consulté ?              | —                                                                |

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
