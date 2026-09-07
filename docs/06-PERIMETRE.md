# Périmètre — ce qu'on construit, ce qu'on ne construit pas

Le besoin exprimé par les cinq pôles, pris au pied de la lettre, représente bien plus que
9-10 semaines à deux à temps partiel. Ce document tranche. Il est fait pour être discuté
avec le client, pas pour être appliqué en silence.

Le principe : **la plateforme centralise le parcours client et l'argent. Elle ne remplace pas
les outils de travail interne de l'équipe.**

## Dans le périmètre

| Besoin exprimé                              | Traitement                                    |
| ------------------------------------------- | --------------------------------------------- |
| Un seul lien pour les réseaux sociaux       | Page d'entrée unique avec traçage de source   |
| Qualification + paiement au même endroit    | Tunnel intégré au site, un seul funnel        |
| Suppression des funnels redondants          | Une offre = une fiche, un seul tunnel         |
| CRM prospects et clients                    | Back-office, cœur du projet                   |
| Suivi RDV, offres, paiements                | Back-office                                   |
| Droits d'accès par rôle                     | RLS Supabase, 5 rôles                         |
| Planning des sessions live                  | Back-office + espace client                   |
| Accès aux replays                           | Espace client, lecteur intégré                |
| Suivi individuel des clients par les coachs | Fiche client + notes de suivi                 |
| Attribution automatique des accès Discord   | Bot, synchronisé sur les paiements            |
| Migration des données existantes            | Phase dédiée                                  |
| Facturation                                 | Génération automatique, numérotation continue |

## Hors périmètre — à faire avec des outils existants

Ces besoins sont réels. Les construire serait une erreur de priorisation.

**Bibliothèque d'assets (logos, visuels, templates)** → Google Drive, dans le Workspace déjà
prévu. Construire un gestionnaire de médias, c'est deux à trois semaines pour reproduire en
moins bien quelque chose qui existe et qui est gratuit dans votre abonnement.

**Calendrier de publication réseaux sociaux** → Notion, Google Calendar, ou un outil dédié.
Ce calendrier ne touche ni au client, ni à l'argent, ni aux données. Il n'a rien à faire dans
la plateforme.

**Charte graphique** → C'est un livrable de design (Figma + PDF), pas un logiciel. Elle
alimente le design system du site, mais « diffuser la charte à l'équipe » se fait par un
fichier partagé.

**Espace documentaire admin (contrats, documents de référence)** → Google Drive. Seules les
factures et attestations liées à un client vivent dans la plateforme, parce qu'elles se
génèrent automatiquement à partir des paiements.

**Messagerie privée entre coach et client** → À discuter sérieusement avec eux. Construire une
messagerie, c'est du temps réel, des notifications, de la modération, une politique de
conservation, et une responsabilité juridique sur le contenu échangé. Compte 3 à 4 semaines
pour une version correcte. Or **Discord fait déjà des messages privés**, et les clients y sont
déjà puisque les cours s'y passent.

Ma recommandation : v1 sans messagerie. Le suivi individuel structuré (notes du coach,
objectifs, historique) vit dans le back-office côté coach ; l'échange conversationnel reste
sur Discord. Si après six mois d'usage le besoin d'une messagerie intégrée est confirmé, elle
se construira sur une base saine.

## La question à trancher avant la phase 2 : les replays

Les cours étant en live, les enregistrements sont ce que le client consulte entre deux
sessions. C'est donc un actif central, et personne ne l'a encore décidé.

| Option                 | Coût indicatif                   | Points d'attention                                                  |
| ---------------------- | -------------------------------- | ------------------------------------------------------------------- |
| YouTube non répertorié | Gratuit                          | Aucun contrôle d'accès réel — un lien qui fuite est un cours offert |
| Vimeo                  | ~20-75 €/mois                    | Restriction par domaine, correct, ergonomie datée                   |
| Cloudflare Stream      | ~5 $/1000 min stockées + lecture | Bon rapport qualité/prix, signature d'URL                           |
| Mux                    | À l'usage, plus cher             | Meilleure qualité, analytics fines                                  |
| Bunny Stream           | Très bon marché                  | Sérieux, moins connu                                                |

Le critère décisif n'est pas le prix mais **le contrôle d'accès** : il faut des URL signées à
durée limitée, générées côté serveur après vérification de l'inscription. Sinon un client
partage un lien et vous n'avez plus de produit.

Mon avis : Cloudflare Stream ou Bunny. À valider selon le volume d'heures enregistrées par mois,
information qu'il faut leur demander.

## Rôles révisés

Les quatre rôles internes évoqués (coach, branding, admin, dev) donnent, avec le client :

| Rôle       | Périmètre                                                              |
| ---------- | ---------------------------------------------------------------------- |
| `client`   | Ses données, son planning, ses replays, sa facturation                 |
| `coach`    | Ses cohortes uniquement : clients, sessions, présences, notes de suivi |
| `branding` | Accès minimal : statistiques de conversion, liens et visuels du site   |
| `admin`    | CRM complet, paiements, remboursements, catalogue, documents           |
| `owner`    | Tout, plus la gestion des rôles et l'audit                             |

**Le rôle `branding` a très peu à faire dans la plateforme** — son travail est en dehors. Ne
lui construisez pas un espace dédié : un accès en lecture aux statistiques suffit largement.

**Le rôle `coach` est le plus délicat.** « Ses cohortes uniquement » est une politique RLS, pas
un filtre d'affichage. Un coach ne doit pas pouvoir lister les clients d'un autre coach, même
en appelant l'API directement.

Pas de rôle `dev` : en production, vous intervenez avec `owner` ou via les accès techniques
Supabase, qui sont hors du modèle de rôles applicatif.

## Ordre de construction révisé

| Phase | Contenu                                                          | Estimation |
| ----- | ---------------------------------------------------------------- | ---------- |
| 1     | Fondations : repo, CI, schéma, auth, RLS, webhook Cal.com        | 1,5 sem    |
| 2     | Back-office : CRM, fiches clients, rôles, logs                   | 3 sem      |
| 3     | Paiement : abstraction, Stripe, PayPal, factures, remboursements | 2 sem      |
| 4     | Discord : bot, liaison de compte, synchronisation des rôles      | 1 sem      |
| 5     | Sessions et replays : planning, présences, lecteur sécurisé      | 1,5 sem    |
| 6     | Site public et tunnel                                            | 2 sem      |
| 7     | Migration des données, recette, mise en production               | 1,5 sem    |

Soit environ 12,5 semaines, contre 9-10 estimées initialement. L'écart vient du bot Discord
devenu critique et des replays qui n'étaient pas au périmètre.

Annoncez 14 semaines au client. Une estimation tenue vaut mieux qu'une estimation flatteuse.
