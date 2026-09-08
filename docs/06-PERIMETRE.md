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

**La visioconférence.** Validé par le chef de projet le 8 septembre 2026, et ça ferme le point
ouvert §8.8 du cahier des charges : les lives et les calls de groupe se **tiennent sur
Discord**, dans le salon vocal du produit. Le site n'héberge aucune visio et n'émet aucun lien
de réunion.

Le processus actuel enchaîne trois outils non synchronisés : un lien Zoom généré à la main,
copié-collé dans les groupes WhatsApp concernés, et un événement mis à jour sur Circle qui sert
de planning de référence. Le point de friction n'est pas Zoom comme outil de visio, c'est la
chaîne manuelle à refaire à l'identique à chaque occurrence.

**Circle et Zoom disparaissent au profit d'un salon vocal Discord privé par produit.** Ça ne
demande aucun développement supplémentaire : `formations.discord_role_id` attribue déjà le rôle
à l'inscription, et la file `discord_sync_queue` le retire en fin d'accès. Un salon visible du
seul rôle du produit remplace à la fois le lien généré à la main et sa diffusion sur WhatsApp.

**Pas de salle d'attente manuelle.** L'idée d'un tri humain en direct, pour faire entrer les
gens un par un, a été évoquée puis écartée : le rôle Discord fait déjà ce filtrage, et la
révocation automatique en fin d'accès (§3, étape 5 du cahier des charges) le fait sans personne
derrière l'écran. Un tri manuel réintroduirait exactement la dépendance qu'on supprime — le
call ne peut plus commencer si celui qui trie est en retard.

**La planification des séances non plus n'est pas au périmètre.** C'était le second rôle de
Circle, et il a fait l'objet d'un aller-retour le 8 septembre 2026 : on a d'abord écrit que la
réservation reviendrait sur le site via Cal.com, avant que les formateurs ne décrivent leur
fonctionnement réel. **Seul le premier rendez-vous se réserve** — l'audit de vente. Ensuite,
les séances individuelles s'organisent directement entre le formateur et son client, et les
séances de groupe suivent un **planning hebdomadaire affiché dans un salon Discord dédié**,
tenu à la main par l'équipe.

Deux raisons données par les formateurs, et qui ne s'inventent pas depuis un fauteuil de
développeur :

- **Un formateur à temps partagé ne peut pas publier ses disponibilités.** Un calendrier de
  réservation qu'il ne tient pas à jour promet au client des créneaux qui n'existent pas.
- **Les séances individuelles s'enchaînent dans un ordre** — psychologie d'abord, technique
  ensuite — piloté à la main entre formateurs. Personne n'a demandé à l'automatiser.

Conséquence heureuse : ni type d'événement Cal.com par produit, ni places par créneau, ni
webhook de séance. La vérification des _seats_ de Cal.com, un temps notée comme bloquante
avant la phase 3, n'a plus lieu d'être.

Ce que ça ne dispense pas de faire : **aucune application Discord n'existe encore** (voir
`apps/bot/README.md`). Le worker est écrit mais n'a jamais tourné en réel, et il est bloquant
dès l'étape 2 du plan de construction.

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

| Phase | Contenu                                                                             | Estimation |
| ----- | ----------------------------------------------------------------------------------- | ---------- |
| 1     | Fondations : repo, CI, schéma, auth, RLS — **fait**                                 | 1,5 sem ✓  |
| 1 bis | Migrations de la révision 3 : renommages, suppressions, nouvelles tables — **fait** | 1 sem ✓    |
| 2     | Tunnel d'entrée : formulaire natif, compte, Discord `invité`, Cal.com               | 2 sem      |
| 3     | Espace formateur : tableau de bord, RDV, fiches, propositions, statistiques         | 2 sem      |
| 4     | Paiement une fois : Stripe, facture, inscription, rôle Discord                      | 2 sem      |
| 5     | Abonnement : renouvellement, échec de prélèvement, résiliation, révocation          | 1,5 sem    |
| 6     | Espace client                                                                       | 1 sem      |
| 7     | Site public : contenu marketing, SEO, pages légales                                 | 2 sem      |
| 8     | Événements, migration des données, recette, mise en production                      | 1,5 sem    |

Soit environ **13 semaines restantes**, 14,5 en comptant la phase 1 déjà livrée. La révision 3
retire 1,5 semaine de replays et de planning de sessions, mais ajoute l'espace formateur et la
mécanique d'abonnement, qui coûtent davantage.

**État au 8 septembre 2026.** Les phases 1 et 1 bis sont livrées. Les phases 2 à 7 sont
**écrites mais jamais exécutées en réel** : ni serveur Discord, ni compte Cal.com, ni clés
Stripe, ni clé serveur Supabase. Le back-office est commencé — garde, navigation et tableau de
bord ; ses autres écrans restent des placeholders. Restent entièrement à faire : la phase 8,
les six pages légales, et le contenu client (biographies, témoignages, visuels, catalogue réel).

Ces estimations ne sont donc pas consommées à hauteur de ce qui est écrit : tant qu'une
fonctionnalité n'a pas tourné contre les vrais services, il faut compter la recette qui va avec.

Annoncez 16 semaines au client. Une estimation tenue vaut mieux qu'une estimation flatteuse.

**Les phases 4 et 5 sont séparées volontairement.** Le paiement unique suffit à vendre les
accompagnements et les formations, c'est-à-dire les gros paniers : la plateforme encaisse dès
la phase 4. L'abonnement communauté peut suivre sans bloquer la mise en service.

**Dépendance à débloquer tôt** : aucune application Discord n'existe encore, et le worker
`apps/bot` n'a jamais tourné en réel. Il devient bloquant dès la phase 2, puisque c'est là que
le rôle `invité` est attribué pour la première fois.

## Ce qui reste à trancher

La question des replays, qui occupait cette place en révision 2, est close : Discord. Celle du
paiement en plusieurs fois l'est aussi depuis le 8 septembre 2026 — **non, tout se paie en une
fois**, et `payment_schedules` a été supprimée.

Trois autres points de cette liste ont été tranchés le même jour et sont sortis d'ici :
**il n'y a pas de règle d'éligibilité côté Tally** — tout prospect qui soumet le formulaire est
éligible, hors refus des mineurs, et le tunnel n'a donc aucun écran « non éligible » à
construire ; **la vente en self-service de l'abonnement communauté est confirmée**, achat
direct depuis `/formations/[slug]`, entorse assumée au principe du tunnel unique ; et **la
remise formateur est autorisée, sans plafond** — Franck décide seul du prix qu'il propose. Le
détail et l'état d'implémentation de chacun sont dans `01-CAHIER-DES-CHARGES.md` §8.

Ne reste réellement à trancher que :

- **L'hébergement des vidéos exclusives.** Un des deux abonnements donne accès à des vidéos
  exclusives, et leur hébergement n'est toujours pas tranché — reconfirmé le 8 septembre 2026.
  Si ces vidéos vivent sur Discord, ce document reste vrai tel quel. Si elles sont sur le site,
  le premier retrait de cette liste — le lecteur à accès restreint et les URL signées — revient
  dans le périmètre, et il coûte. À trancher avant la phase 5.
- **La TVA hors Europe** — question pour le comptable, à poser avant la première facture.
