# Périmètre — ce qu'on construit, ce qu'on ne construit pas

Révision 3, 8 septembre 2026. Le besoin exprimé par les cinq pôles, pris au pied de la lettre,
représente bien plus que 9-10 semaines à deux à temps partiel. Ce document tranche. Il est
fait pour être discuté avec le client, pas pour être appliqué en silence.

Le principe : **la plateforme centralise le parcours client et l'argent. Elle ne remplace pas
les outils de travail interne de l'équipe.**

## Dans le périmètre

| Besoin exprimé                                 | Traitement                                         |
| ---------------------------------------------- | -------------------------------------------------- |
| Un seul lien pour les réseaux sociaux          | Page d'entrée unique avec traçage de source        |
| Qualification puis rendez-vous au même endroit | Formulaire natif, compte créé, `/reserver`         |
| Suppression des funnels redondants             | Un produit = une fiche, un seul tunnel             |
| CRM prospects et clients                       | Back-office, cœur du projet                        |
| Tableau de bord formateur                      | Zone dédiée : RDV, fiches, propositions, stats     |
| Proposition commerciale après l'audit          | Émise depuis `/formateur`, traçable et expirable   |
| Suivi RDV, catalogue, paiements                | Back-office                                        |
| Droits d'accès par rôle                        | RLS Supabase, 5 rôles                              |
| Abonnement mensuel et achats uniques           | Deux mécaniques de paiement, une mécanique d'accès |
| Attribution automatique des accès Discord      | Bot, synchronisé sur les inscriptions              |
| Révocation automatique en fin d'accès          | Tâche planifiée + file Discord                     |
| Migration des données existantes               | Phase dédiée                                       |
| Facturation                                    | Génération automatique, numérotation continue      |

## Hors périmètre — à faire avec des outils existants

Ces besoins sont réels. Les construire serait une erreur de priorisation.

**Les replays sur le site.** Ils vivent sur Discord, avec le reste du contenu. Le site
n'héberge que de la vidéo marketing, publique par nature — donc aucun contrôle d'accès, aucune
URL signée, aucun lecteur sécurisé à construire. C'est le plus gros retrait de la révision 3 :
la révision 2 en faisait « la seule page techniquement délicate du front client ».

**La billetterie des événements.** La page `/evenements` est reportée après la première
livraison, et se limitera à une liste ; « prendre son ticket » appellera un organisme externe.
Gérer des réservations, des quotas, des remboursements de billets et des listes d'attente est
un produit en soi.

**Le planificateur de rendez-vous.** Cal.com à 12 $/utilisateur/mois, et encore, seulement si
les webhooks s'avèrent payants. Générer des créneaux est simple ; synchroniser
bidirectionnellement l'agenda personnel du formateur ne l'est pas, et sans ça il se fait
réserver un créneau où il n'est pas libre. Ajoutez les fuseaux horaires — le formulaire
accepte cinq zones géographiques — les annulations, les reports et les rappels : deux à trois
semaines pour reproduire moins bien ce qui coûte le prix d'un déjeuner.

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

**Messagerie privée entre formateur et client** → À discuter sérieusement avec eux. Construire
une messagerie, c'est du temps réel, des notifications, de la modération, une politique de
conservation, et une responsabilité juridique sur le contenu échangé. Compte 3 à 4 semaines
pour une version correcte. Or **Discord fait déjà des messages privés**, et les clients y sont
déjà puisque tout le contenu s'y trouve.

Ma recommandation : v1 sans messagerie. Le suivi individuel structuré (notes du formateur,
objectifs, historique) vit dans `/formateur` ; l'échange conversationnel reste sur Discord. Si
après six mois d'usage le besoin d'une messagerie intégrée est confirmé, elle se construira
sur une base saine.

## Rôles révisés

| Rôle        | Périmètre                                                                   |
| ----------- | --------------------------------------------------------------------------- |
| `client`    | Ses données, ses rendez-vous, ses propositions, sa facturation              |
| `formateur` | Ses affectations uniquement : clients, rendez-vous, notes, ses statistiques |
| `branding`  | Accès minimal : statistiques de conversion, liens et visuels du site        |
| `admin`     | CRM complet, paiements, remboursements, catalogue, documents                |
| `owner`     | Tout, plus la gestion des rôles et l'audit                                  |

**Le rôle `branding` a très peu à faire dans la plateforme** — son travail est en dehors. Ne
lui construisez pas un espace dédié : un accès en lecture aux statistiques suffit largement.

**Le rôle `formateur` est le plus délicat.** « Ses affectations uniquement » est une politique
RLS, pas un filtre d'affichage. Un formateur ne doit pas pouvoir lister les clients d'un
autre, même en appelant l'API directement — et il ne voit jamais un montant.

Pas de rôle `dev` : en production, vous intervenez avec `owner` ou via les accès techniques
Supabase, qui sont hors du modèle de rôles applicatif.

**Ne pas confondre avec les rôles Discord**, qui sont un système distinct : `invité` à la
création du compte, puis un rôle par produit acheté, révoqué à la fin de l'accès. Voir
`01-CAHIER-DES-CHARGES.md` §2.

## Ordre de construction révisé

Le découpage de la révision 2 était organisé autour des cohortes et des replays, qui ont
disparu. Le nouveau suit le chemin de l'argent — c'est aussi le chemin le plus court vers
quelque chose d'utilisable.

| Phase | Contenu                                                                     | Estimation |
| ----- | --------------------------------------------------------------------------- | ---------- |
| 1     | Fondations : repo, CI, schéma, auth, RLS — **fait**                         | 1,5 sem ✓  |
| 1 bis | Migrations de la révision 3 : renommages, suppressions, nouvelles tables    | 1 sem      |
| 2     | Tunnel d'entrée : formulaire natif, compte, Discord `invité`, Cal.com       | 2 sem      |
| 3     | Espace formateur : tableau de bord, RDV, fiches, propositions, statistiques | 2 sem      |
| 4     | Paiement une fois : Stripe, facture, inscription, rôle Discord              | 2 sem      |
| 5     | Abonnement : renouvellement, échec de prélèvement, résiliation, révocation  | 1,5 sem    |
| 6     | Espace client                                                               | 1 sem      |
| 7     | Site public : contenu marketing, SEO, pages légales                         | 2 sem      |
| 8     | Événements, migration des données, recette, mise en production              | 1,5 sem    |

Soit environ **13 semaines restantes**, 14,5 en comptant la phase 1 déjà livrée. La révision 3
retire 1,5 semaine de replays et de planning de sessions, mais ajoute l'espace formateur et la
mécanique d'abonnement, qui coûtent davantage.

Annoncez 16 semaines au client. Une estimation tenue vaut mieux qu'une estimation flatteuse.

**Les phases 4 et 5 sont séparées volontairement.** Le paiement unique suffit à vendre les
accompagnements et les formations, c'est-à-dire les gros paniers : la plateforme encaisse dès
la phase 4. L'abonnement communauté peut suivre sans bloquer la mise en service.

**Dépendance à débloquer tôt** : aucune application Discord n'existe encore, et le worker
`apps/bot` n'a jamais tourné en réel. Il devient bloquant dès la phase 2, puisque c'est là que
le rôle `invité` est attribué pour la première fois.

## Ce qui reste à trancher

La question des replays, qui occupait cette place en révision 2, est close : Discord.
Restent, détaillées dans `01-CAHIER-DES-CHARGES.md` §8 :

- **Les règles d'éligibilité du formulaire** — la plus urgente, elle bloque la
  reconstruction du tunnel à l'identique.
- **La vente en self-service de l'abonnement communauté**, qui ferait une entorse assumée au
  principe du tunnel unique.
- **Le paiement en plusieurs fois** sur les paniers annoncés jusqu'à 5 000 € et plus.
- **La TVA hors Europe** — question pour le comptable, à poser avant la première facture.
