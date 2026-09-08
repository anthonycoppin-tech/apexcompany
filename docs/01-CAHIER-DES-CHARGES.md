# Cahier des charges — parcours client (révision 3)

Document d'entrée. À lire avant `02-SITEMAP.md` et `04-DATA-MODEL.md`, qu'il corrige sur
plusieurs points structurants.

Écrit le 8 septembre 2026 à partir des précisions du chef de projet et du formulaire de
qualification réel (annexe §9). Les révisions 1 et 2 décrivaient une plateforme de formation
en cohortes avec des replays hébergés côté site. Ce n'est pas le produit. Le produit est un
**tunnel de qualification vers un rendez-vous de vente**, suivi d'un accès individuel à du
contenu qui vit sur Discord.

L'écart n'est pas cosmétique : il supprime des pans entiers de la spec précédente et en
ajoute un qui n'existait pas (l'espace formateur). D'où ce document plutôt qu'une série de
retouches.

## Ce que ce document remplace

| Point                         | Ancienne spec                                                    | Désormais                                                                                      |
| ----------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Ordre du tunnel               | Fiche offre → RDV → qualification → paiement, compte au paiement | Qualification → **compte** → RDV → proposition → paiement                                      |
| Catalogue                     | Une seule forme d'offre                                          | **Trois types de produit** aux mécaniques d'accès différentes (§1)                             |
| Replays                       | Espace client, lecteur sécurisé, URL signées                     | **Sur Discord.** Rien côté site sauf vidéo marketing                                           |
| Hébergeur vidéo               | Décision en attente (Cloudflare / Bunny)                         | **Décision close** : Discord héberge, Vimeo pour le marketing                                  |
| Cohortes, sessions, présences | Cœur du modèle, ancrage de la RLS coach                          | **Supprimés.** Parcours individuel                                                             |
| Espace coach                  | Accès dégradé au back-office                                     | **Zone dédiée `/formateur`** avec son propre tableau de bord                                   |
| Calendrier                    | Cal.com (`appointments.cal_booking_id`, `api/cal`)               | **Cal.com confirmé** — le Tally actuel renvoie vers Calendly, non reconduit (§3 ét. 2)         |
| Vocabulaire                   | `offres`, `coach`                                                | **`formations`, `formateur`** — arbitré, migration à écrire                                    |
| Événements                    | Page du site public v1                                           | **Reporté** après la première livraison, billetterie externe                                   |
| Individuel ou groupe          | Implicite : cohorte = groupe, `coaching_sessions` = individuel   | **`formations.modalite`**, explicite — mais les séances restent hors plateforme (§3 ét. 4 bis) |

Tout le reste de `02-SITEMAP.md`, `04-DATA-MODEL.md` et `06-PERIMETRE.md` reste valable — en
particulier les règles de sécurité, qui ne bougent pas.

---

## 1. Le catalogue : trois types de produit

C'est la découverte la plus structurante de la révision 3, et elle précède tout le reste :
il n'y a pas un produit mais trois, qui ne se paient pas de la même façon et ne donnent pas
accès de la même façon.

| Type             | Paiement              | Durée d'accès       | Exemple                              |
| ---------------- | --------------------- | ------------------- | ------------------------------------ |
| `abonnement`     | **Récurrent mensuel** | Tant qu'il est payé | Accès à la communauté                |
| `accompagnement` | Une fois              | 1, 3 ou 6 mois      | Suivi sur une période                |
| `formation`      | Une fois              | Illimité            | Une formation achetée définitivement |

**Une seule mécanique d'accès couvre les trois** : `inscriptions.date_fin_acces`.

- `accompagnement` — fixée à l'achat : `date_debut + duree_acces_jours` (30, 90, 180).
- `abonnement` — repoussée à chaque prélèvement réussi, d'un mois. Une résiliation ou un
  échec de paiement ne coupe rien immédiatement : la date reste celle de la fin de la
  période déjà payée, et la révocation se fait toute seule quand elle est atteinte.
- `formation` — `null`, qui signifie **accès illimité**. Le balayage de révocation ignore
  les lignes à `null` par construction.

Cette convention est ce qui permet de ne développer **qu'un seul** mécanisme de révocation
Discord (§3, étape 5) pour trois modèles économiques. Ne pas la contourner en ajoutant une
logique par type dans le worker : le worker lit une date, il n'a pas à savoir ce qui a été
vendu.

En revanche la **couche paiement porte bien deux mécaniques distinctes** : un abonnement
Stripe (avec ses renouvellements, ses échecs de prélèvement, ses relances et sa résiliation)
n'a presque rien de commun avec un paiement unique. C'est le vrai surcoût de la révision 3
côté serveur, et il faut le budgéter comme tel.

### Le type de produit ne dit pas comment le cours se donne

Deuxième axe, indépendant du premier et ajouté le 8 septembre 2026 : **une formation se donne
en individuel ou en groupe**, et ça ne se déduit pas de `type_produit`. Un accompagnement peut
être un suivi en tête-à-tête comme une promotion qui avance ensemble ; deux produits du même
type peuvent se donner différemment. D'où une colonne à part, `formations.modalite`
(`individuel` / `groupe`).

Les deux axes ne se recouvrent pas et il ne faut pas les fusionner :

| Ce que ça décide | Porté par                    |
| ---------------- | ---------------------------- |
| Comment on paie  | `type_produit`               |
| Combien de temps | `duree_acces_jours`          |
| Comment on suit  | `modalite`                   |
| Ce qu'on voit    | `discord_role_id` (le salon) |

**L'accès ne change pas d'un iota.** Individuel ou groupe, c'est un rôle Discord, une
`date_fin_acces` et une révocation ; le worker continue de ne lire qu'une date. `modalite`
informe le client sur la fiche produit et dit au formateur ce qu'il a vendu — elle ne décide
de rien côté accès, et rien côté planification, qui se passe hors plateforme (§3, étape
4 bis).

---

## 2. Les deux systèmes de rôles

Deuxième chose à comprendre, parce que la confusion est facile : **il y a deux systèmes de
rôles qui ne se recouvrent pas.**

**Les rôles applicatifs** vivent dans `user_roles`. Ils décident de ce qu'une requête a le
droit de lire dans la base, via la RLS. Ils ne changent pas : `client`, `formateur`,
`branding`, `admin`, `owner`.

**Les rôles Discord** vivent sur le serveur Discord. Ils décident de ce qu'une personne voit
comme contenu : salons, conférences, replays.

| Événement                      | Rôle applicatif     | Rôle Discord                          |
| ------------------------------ | ------------------- | ------------------------------------- |
| Formulaire rempli, compte créé | `client`            | `invité`                              |
| Produit payé                   | `client` (inchangé) | `invité` + le rôle du produit         |
| Fin d'accès                    | `client` (inchangé) | `invité` seul, rôle du produit retiré |

Conséquences à ne pas perdre de vue :

- **`invité` n'est pas un rôle applicatif.** Côté site, cette personne est un `client` sans
  inscription active. Ajouter `invité` à l'énumération `app_role` mélangerait l'accès au
  contenu avec les droits d'administration, dans la table même qui décide qui est `owner`.
- **Aucun rôle Discord ne peut être attribué avant que le client n'ait lié son compte.** Le
  worker accorde un rôle à un identifiant Discord, qu'il lit dans `discord_links` ; tant que
  personne ne l'a rempli, empiler un `grant` ne produit qu'une ligne en échec. La liaison se
  fait par le fournisseur Discord de Supabase Auth (`linkIdentity`, scope `identify`), et
  c'est son retour — `api/discord/callback` — qui écrit la liaison **puis** empile le rôle
  `invité`. Cette étape est proposée **après** la réservation du créneau : rien ne doit
  s'interposer entre le formulaire et la prise de rendez-vous, qui est la seule étape du
  tunnel produisant du chiffre d'affaires. Elle reste ensuite accessible en permanence depuis
  `/espace/communaute`, parce qu'une personne qui la saute doit pouvoir y revenir.
- **Le rôle applicatif ne change jamais après la création du compte.** Payer ne promeut
  personne. Ce qui change, c'est l'existence d'une ligne dans `inscriptions`.
- **Le rôle Discord se déduit de l'inscription, jamais l'inverse.** La base est la source de
  vérité ; Discord en est le reflet, tenu à jour par la file.
- **Un client peut cumuler.** Abonnement communauté + accompagnement 3 mois = deux
  inscriptions actives, deux rôles Discord, deux dates de fin indépendantes. Le modèle le
  permet déjà ; l'interface doit le prévoir dès le premier écran.

---

## 3. Le parcours, de bout en bout

```
Réseaux sociaux
      │  ?src=ig|yt|tt|snap
      ▼
 /  Accueil ────────► /formations  (consultation libre)
      │
      ▼
 /qualification   Formulaire 8 questions ──► compte créé + rôle Discord « invité »
      │                                       │
      │ éligible                              │ non éligible
      ▼                                       ▼
 /reserver        formateur + créneau      Espace client + communauté Discord
      │           (Cal.com)                 (pas de RDV proposé)
      ▼
 Audit stratégique ──► le formateur émet une PROPOSITION depuis /formateur
      │
      ▼
 /espace/propositions/[id] ──► paiement ──► inscription active
                                              │
                                              ├─► rôle Discord du produit
                                              └─► facture
      │
      ▼
 Les séances se tiennent hors plateforme
                   modalite = individuel ─► formateur et client s'arrangent
                   modalite = groupe     ─► annoncée sur Discord, salon du produit
      │
      ▼  date_fin_acces dépassée (ou jamais, si null)
 Révocation automatique du rôle Discord
```

### Étape 1 — Le formulaire de qualification

Huit questions, toutes obligatoires, réparties sur cinq écrans. Le détail exact des libellés
et des options est en annexe §9 : **c'est la source de vérité pour l'implémentation.**

Reconstruit nativement sur le site plutôt qu'en embed Tally, pour une raison précise :
**une iframe ne peut pas ouvrir de session**. Avec Tally il faudrait un webhook, la création
du compte après coup, et un aller-retour par email avant la prise de RDV — exactement au
moment où l'intention est la plus forte. En natif, le compte, le lead et le consentement
s'écrivent dans la même transaction et la personne enchaîne directement sur le calendrier.

Le prix à payer est réel et il faut l'assumer : le marketing ne modifie plus les questions
tout seul. Prévoir que la liste des questions soit une donnée de configuration, pas du JSX en
dur, pour que le changement reste une petite tâche.

**Où atterrit chaque réponse.** La règle : une réponse devient une colonne de `leads` si le
CRM filtre, trie ou décide dessus ; sinon elle reste dans le jsonb. Le formateur lit
l'intégralité avant l'appel, mais le pipeline ne se trie que sur ce qui pilote une décision
commerciale.

| Réponse                  | Destination            | Pourquoi                                      |
| ------------------------ | ---------------------- | --------------------------------------------- |
| Prénom, email, téléphone | `leads` + `profiles`   | Identité, et le téléphone sert à rappeler     |
| Zone géographique        | `leads.zone_geo`       | Fuseau des créneaux, et TVA (§8.4)            |
| Tranche d'âge            | `leads.tranche_age`    | Filtre légal des mineurs (voir plus bas)      |
| Niveau en trading        | `leads.niveau_trading` | Segmentation, oriente le produit proposé      |
| Blocage principal        | `leads.blocage`        | C'est l'argument de vente — visible en liste  |
| Budget déclaré           | `leads.tranche_budget` | Détermine ce que le formateur peut proposer   |
| Délai souhaité           | `leads.delai_objectif` | Priorité de rappel : « le plus vite » d'abord |
| Situation pro, prop firm | `lead_events` (jsonb)  | Contexte utile à l'appel, pas au tri          |

Les réponses **complètes** partent en plus dans `lead_events`, en jsonb, dans une ligne de
type `formulaire_soumis`. C'est la table d'historique immuable et elle est faite pour ça :
si les questions changent, les anciennes soumissions restent lisibles telles qu'elles ont
été remplies. Les colonnes de `leads` sont une projection, pas l'original.

**Trois ajouts par rapport au formulaire Tally**, arbitrés le 8 septembre 2026. Le
formulaire actuel ne les fait pas ; la version reconstruite les fait.

- **Refus dur des moins de 18 ans.** La question sur l'âge existe déjà mais ne déclenche
  rien. Désormais, répondre « moins de 18 ans » **arrête le parcours immédiatement** : pas de
  compte créé, pas de lead, pas de rôle Discord, un message explicite. Vendre de la formation
  au trading à un mineur et recueillir son consentement n'est pas un problème de filtrage
  commercial mais de responsabilité, et un mineur qualifié « non éligible » resterait en base
  avec ses coordonnées — donc traité comme un prospect à relancer. C'est un arrêt, pas un
  filtre.

  Conséquence d'implémentation : cette question doit rester **sur son propre écran, avant
  toute écriture en base**. Si l'âge est demandé au même moment que le reste, on a déjà
  collecté les données d'un mineur au moment de les refuser.

- **Consentement RGPD explicite.** On collecte email et téléphone pour un usage commercial :
  case à cocher non pré-cochée à la dernière étape, avec un lien vers la politique de
  confidentialité. Enregistré dans `consents` — horodaté, avec la **version du texte** en
  vigueur, sinon on ne peut pas prouver à quoi la personne a consenti le jour où elle le
  demande. La table existe déjà, elle n'attend que d'être remplie.

- **Nom de famille collecté au paiement, pas ici.** Une facture a besoin d'une identité
  complète, mais on n'alourdit pas un formulaire de qualification pour une obligation qui
  n'arrive qu'après la vente. À prévoir explicitement dans le tunnel de paiement : sans ça,
  `leads.nom` reste vide et les factures sont non conformes.

**Le formulaire filtre.** L'écran final affiche « Bonne Nouvelle ! Ton profil est éligible »,
donc une règle d'éligibilité existe déjà côté Tally. Elle doit être explicitée pour être
reconstruite — c'est le point ouvert §8.1. En l'état, le seul critère que le formulaire rend
plausible est le budget déclaré. Un prospect non éligible garde son compte et son accès
communauté, mais ne se voit pas proposer de créneau — à la différence du mineur, qui n'entre
jamais.

### Étape 2 — La prise de rendez-vous

Le RDV s'appelle un **audit stratégique** : le formulaire le nomme ainsi et le présente comme
un point sur la situation du prospect, pas comme la présentation d'un produit.

**Le calendrier sera Cal.com.** Le formulaire Tally renvoie aujourd'hui vers Calendly ; on ne
le reconduit pas. Décision déléguée aux développeurs et prise le 8 septembre 2026.

Le besoin réel est étroit : **une seule chose doit venir de l'extérieur**, la disponibilité
d'une personne et la réservation d'un créneau.

**Et cette personne est Franck, seul.** Précisé par le chef de projet le 8 septembre 2026 :
c'est lui qui prend tous les rendez-vous, et lui seul qui attribue ensuite la formation au
compte du client. Le prospect ne choisit donc pas son interlocuteur, et `/reserver` n'aiguille
vers personne — c'est **une seule page de réservation**, celle de Franck. L'écran de choix du
formateur, prévu par la révision 2, n'a pas lieu d'être.

Trois conséquences, toutes dans le bon sens :

- **Aucune fonctionnalité d'équipe** — ni round-robin, ni page d'équipe — qui sont justement
  ce que les deux outils facturent le plus cher.
- **Un seul utilisateur Cal.com, un seul type d'événement.** Le plan gratuit suffit, et si les
  webhooks s'avèrent réservés au plan payant, la facture est de 12 $ par mois pour une
  personne, pas par formateur.
- **`appointments.conseiller_id` vaut Franck à la création.** Le webhook n'a personne à
  déduire du créneau réservé, ce qui retire le seul endroit où l'affectation aurait pu se
  faire toute seule — et c'est cohérent avec l'affectation explicite retenue pour la RLS.

Ce qui reste indispensable : **le webhook**. Sans retour vers notre base, aucune ligne
`appointments` ne se crée, donc pas de tableau de bord formateur, pas de statistique de
no-show, pas de fiche client à jour — c'est-à-dire l'essentiel de ce qui a été demandé.

| Critère                              | Cal.com                       | Calendly                      |
| ------------------------------------ | ----------------------------- | ----------------------------- |
| Plan gratuit                         | Types d'événement illimités   | **1 seul** type d'événement   |
| Webhooks                             | À vérifier (voir plus bas)    | Standard, **10 $/siège/mois** |
| Fonctions d'équipe (non nécessaires) | 12 $/utilisateur/mois         | 16 $/siège/mois               |
| Code source                          | Open source, auto-hébergeable | Fermé                         |

Trois raisons, la dernière étant la moins évidente et la plus solide :

- **Moins cher à besoin égal**, et nettement plus généreux en gratuit.
- **Le schéma n'a rien à changer.** `appointments.cal_booking_id` et la route `api/cal`
  existent déjà : la révision 3 ajoute assez de migrations comme ça, en voici une qu'on
  n'écrira pas.
- **Il existe une porte de sortie.** Cal.com est open source et auto-hébergeable. Si les
  tarifs changent ou si l'outil devient un point de blocage, on récupère le service. Avec
  Calendly, il n'y a aucune sortie — et un calendrier de vente qu'on ne contrôle pas est une
  dépendance sur la seule étape du tunnel qui produit du chiffre d'affaires.

**À vérifier à l'inscription, cinq minutes** : la grille tarifaire de Cal.com liste les
webhooks dans la colonne Teams, alors que sa documentation n'annonce aucune restriction de
plan. Créer un compte gratuit et regarder si le réglage « Webhooks » est présent tranche la
question. Si les webhooks s'avèrent payants, le coût est de 12 $/utilisateur/mois — toujours
sous Calendly, et sans perdre l'auto-hébergement comme recours.

L'auto-hébergement, justement, n'est **pas** recommandé pour démarrer : il faut un Postgres
et un service Node de plus à maintenir, sur une équipe qui ne peut déjà pas faire tourner
Docker en local. C'est un recours, pas un point de départ.

Enfin, écrire ce planificateur nous-mêmes a été écarté sans hésiter. Générer des créneaux est
simple ; la synchronisation bidirectionnelle avec l'agenda personnel du formateur ne l'est
pas, et sans elle un formateur se fait réserver un créneau où il n'est pas libre. À ça
s'ajoutent les fuseaux horaires — le formulaire accepte cinq zones géographiques — les
annulations, les reports et les rappels. Deux à trois semaines pour reproduire moins bien ce
qui coûte 12 $ par mois.

**Faut-il choisir sa formation avant l'audit ?** Le chef de projet l'a demandé (« à la page
de RDV on choisit la formation qui nous intéresse »). Le formulaire, lui, capte déjà le
budget, le niveau et le blocage — c'est-à-dire l'essentiel de ce qui oriente une
recommandation. Et son propre texte de vente dit que l'appel sert à « confirmer que
l'accompagnement est parfaitement aligné avec ta situation ».

Recommandation : **garder `/formations` comme catalogue public** — il rassure et il fait
vendre — mais **ne pas conditionner la réservation à un choix de produit**. Faire choisir
avant l'audit enferme le formateur dans une proposition que le prospect a faite lui-même
avant d'avoir parlé à quiconque, et affaiblit le seul moment où l'on peut réorienter
quelqu'un. Si l'on tient à capter l'intention, la formuler comme une question ouverte et
facultative (« qu'est-ce qui t'intéresse ? ») plutôt que comme une étape obligatoire.

Dans les deux cas, la donnée reste distincte de la vente finale : `leads.produit_souhaite_id`
(déclaré par le prospect) et `leads.produit_recommande_id` (retenu par le formateur après
l'appel). Le chef de projet a été explicite, « suivant comment se passe le RDV la formation
peut changer » — écraser l'un par l'autre ferait disparaître l'information la plus
intéressante du CRM : l'écart entre ce que les gens croient vouloir et ce qu'on leur vend.

### Étape 3 — L'audit et la proposition

Le processus actuel : le formateur donne à la fin de l'appel « le lien final pour la
formation adéquate ».

**Proposition d'amélioration — à arbitrer, c'est le seul vrai changement de processus que ce
document propose.** Plutôt qu'un lien de paiement collé dans Discord ou dans un mail, le
formateur ouvre la fiche du client dans `/formateur`, choisit le produit, le paiement, et
valide. Le système crée une **proposition** : elle apparaît dans l'espace du client, part par
email, et porte une date d'expiration.

Quatre raisons, dans l'ordre d'importance :

- **La conversion devient mesurable.** Qui a proposé quoi, à quel prix, et est-ce que ça a
  été payé. C'est la statistique que le tableau de bord formateur doit afficher, et un lien
  Stripe collé à la main n'en donne aucune.
- **Le produit vendu change souvent** — c'est le cas nominal ici. Une nouvelle proposition
  remplace la précédente et l'historique garde la trace du changement. Avec des liens bruts,
  deux liens restent valides en même temps et personne ne sait lequel fait foi.
- **Une proposition expire.** C'est un levier de vente, et ça évite qu'un lien à 5 000 €
  émis en janvier soit payé en septembre au tarif de janvier.
- **Le prix est tracé.** Si le formateur peut accorder une remise, elle doit être plafonnée
  et journalisée. Un prix négociable et non auditable, sur ce niveau de panier, est un
  problème qui se découvre à la comptabilité.

Le lien envoyé pointe vers une page **authentifiée** (`/espace/propositions/[id]`), pas vers
un jeton public. C'est le bénéfice direct du tunnel inversé : le compte existe déjà, donc la
RLS protège la proposition sans qu'on ait à inventer un mécanisme de jeton signé.

Le formateur consigne aussi l'issue du RDV : honoré, absent, annulé, plus un compte rendu.
Sans ça, pas de statistique de no-show — et le no-show est le premier poste de perte d'un
tunnel de vente par appel.

### Étape 4 — Le paiement et l'ouverture des accès

Inchangé par rapport à `04-DATA-MODEL.md`, et c'est voulu : cette partie est la plus solide
de la spec existante.

Webhook → insertion dans `payment_events` **d'abord**, dans la même transaction que le
traitement métier ; violation de la contrainte unique = événement déjà traité, on sort. Puis
`orders` payé, `inscriptions` créée avec sa `date_fin_acces` selon le type de produit (§1),
facture émise à numérotation continue, et un ordre `grant` dans `discord_sync_queue`. Jamais
d'appel direct à l'API Discord depuis un handler de paiement.

Ce qui s'y ajoute avec l'abonnement : les événements de **renouvellement** (repousser
`date_fin_acces` d'un mois), d'**échec de prélèvement** et de **résiliation**. Ils passent
par le même chemin d'idempotence — un renouvellement rejoué ne doit pas offrir deux mois.

### Étape 4 bis — Les séances, une fois l'accès ouvert

Précisé par les formateurs le 8 septembre 2026, après un aller-retour qui a d'abord conclu
l'inverse. **La plateforme ne planifie aucune séance.** Elle ne sert qu'à ouvrir l'accès ;
ce qui se passe ensuite se passe entre le formateur et son client.

| Ce qui se passe après l'achat | Où                                                             |
| ----------------------------- | -------------------------------------------------------------- |
| Séance individuelle           | Le formateur et le client s'arrangent directement              |
| Séance de groupe              | **Planning hebdomadaire**, affiché dans un salon Discord dédié |

Le planning de groupe est donc un **salon Discord de plus** à créer, distinct du salon vocal
où se tiennent les calls : un salon texte où l'équipe publie la semaine à venir. Sa tenue est
un geste hebdomadaire de l'équipe, pas une fonctionnalité — et c'est bien ce qui la rend
gratuite à mettre en place.

**Cal.com ne sert donc qu'une fois dans le parcours** : l'audit de vente de l'étape 2. Ni
type d'événement par produit, ni places par créneau, ni webhook de séance — rien de tout ça
n'est à construire ni même à vérifier.

Deux raisons, données par les formateurs eux-mêmes, et qui valent d'être écrites parce
qu'elles ne sont pas évidentes de l'extérieur :

- **Un formateur à temps partagé ne peut pas publier ses disponibilités.** Celui qui tient
  les calls techniques a une entreprise à côté et ne peut pas s'engager à l'avance sur des
  créneaux. Un calendrier de réservation qu'il ne peut pas tenir à jour est pire que pas de
  calendrier : il promet au client des créneaux qui n'existent pas.
- **Les séances individuelles s'enchaînent dans un ordre** — psychologie d'abord, technique
  ensuite. Cet enchaînement se pilote aujourd'hui à la main, entre formateurs, et personne
  n'a demandé à l'automatiser.

**Ce qu'on n'a donc volontairement pas** : pas d'écran de réservation dans l'espace client,
pas de table de séances, pas de compte rendu de séance, pas de statistique de présence. Le
tableau de bord formateur porte sur les **audits de vente** et les propositions, pas sur la
prestation. Si le besoin d'un suivi structuré apparaît à l'usage, il se construira sur cette
base — mais le construire maintenant, ce serait imposer une saisie à deux formateurs qui n'en
ont pas demandé, et ce qui n'est pas obligatoire n'est pas rempli.

`formations.modalite` reste utile pour autant (§1) : c'est ce que le client lit sur la fiche
produit avant d'acheter, et ce qui dit au formateur ce qu'il a vendu.

### Étape 5 — La fin d'accès

Mécanisme nouveau, à construire : une tâche planifiée quotidienne cherche les inscriptions
dont la `date_fin_acces` est dépassée, les passe en `terminee`, et empile un `revoke` dans
`discord_sync_queue`. Le worker fait le reste. Les inscriptions à `date_fin_acces null` — les
formations achetées définitivement — ne sont jamais sélectionnées.

Un client qui perd son accompagnement mais garde son abonnement communauté ne doit perdre
**que** le rôle correspondant. La révocation se raisonne par inscription, jamais par
personne.

---

## 4. Les écrans

### Site public

```
/                        Accueil — point d'entrée unique des réseaux, vidéo d'accroche
/formations              Catalogue — les trois types de produit
/formations/[slug]       Fiche produit
/qualification           Le formulaire — crée le compte
/reserver                Formateur + créneau (connecté, éligible)
/formateurs              L'équipe
/faq
/contact
/evenements              → reporté après la première livraison

/mentions-legales  /cgv  /confidentialite  /cookies  /remboursement  /accessibilite
```

### Espace client

```
/espace                   Ses accès en cours, Discord, prochain RDV
/espace/rendez-vous       RDV passés et à venir
/espace/propositions/[id] Proposition reçue → paiement
/espace/factures          Factures, échéances, et gestion de l'abonnement
/espace/compte            Informations personnelles
/espace/communaute        État de la liaison Discord, lien d'accès
```

**Pas d'écran de réservation de séance** (§3, étape 4 bis) : après l'achat, les séances
individuelles s'organisent directement entre le formateur et son client, et les séances de
groupe sont annoncées sur Discord. L'espace client sert à voir ses accès, ses factures et ses
rendez-vous de vente — pas à planifier la prestation.

Le chef de projet hésitait sur les RDV passés et à venir (« peut-être ? »). **À garder** : la
donnée existe déjà pour le tableau de bord formateur, l'écran coûte presque rien, et il
supprime la question de support la plus fréquente d'un produit qui vend des rendez-vous.

`/espace/factures` porte une responsabilité de plus depuis l'arrivée de l'abonnement :
**permettre de résilier**. Un abonnement qu'on ne peut annuler que par email est une source
de litige, et selon les cas une non-conformité.

Disparaissent : `/espace/planning` (plus de sessions de cohorte), `/espace/replays` (Discord),
`/espace/suivi` (les notes du formateur restent internes en v1).

### Espace formateur

```
/formateur               Tableau de bord : RDV du jour, à venir, propositions en attente
/formateur/rendez-vous   Audits passés et à venir, issue et compte rendu
/formateur/clients       Ses clients et ses prospects
/formateur/clients/[id]  Réponses au formulaire, historique, RDV, notes, statut d'accès,
                         coordonnées — et **jamais un montant**
/formateur/statistiques  RDV honorés, no-show, propositions émises, taux de conversion
```

La fiche client affiche en tête ce que le formulaire a capté : **budget déclaré, blocage
principal, niveau, délai**. C'est ce qui prépare l'appel, et c'est disponible gratuitement
puisque la personne vient de le saisir.

**Le périmètre du formateur doit être redéfini.** Sans cohortes, `cohorte_coachs` — que
`04-DATA-MODEL.md` désigne comme portant « toute la sécurité du rôle coach » — n'a plus
d'objet. Il faut un autre ancrage, et le choix compte : c'est lui qui empêche un formateur de
lister les clients d'un autre.

Recommandation : une **affectation explicite**, `leads.assigned_to` (existe déjà) et
`inscriptions.formateur_id` (à ajouter). Pas une dérivation implicite depuis les rendez-vous
— « il a eu un appel avec cette personne un jour » élargit le périmètre en silence à chaque
RDV repris d'un collègue absent, et ne se teste pas proprement.

L'invariant de `CLAUDE.md` survit tel quel et reste testé en pgTAP : **un formateur ne voit
que ses clients, et jamais d'argent.** Seul son énoncé change — « ses cohortes » devient
« ses affectations ».

### Back-office

Inchangé par rapport à `02-SITEMAP.md`, moins `/admin/cohortes`, `/admin/sessions` et
`/admin/coaching`, plus une vue des propositions émises et une vue des abonnements actifs
(renouvellements à venir, échecs de prélèvement, résiliations).

---

## 5. Conséquences sur le modèle de données

À construire par le développeur A. Chaque ligne est une migration, jamais une modification
d'une migration déjà appliquée.

**Renommages arbitrés** : `offres` → `formations`, `app_role.coach` → `formateur`, et les
colonnes qui les référencent. Rien n'est en production, donc c'est le moment ou jamais : la
même opération dans trois mois coûtera dix fois plus. Emporte l'énumération, les politiques
RLS, les tests pgTAP, le seed et `packages/db`.

**Tables qui disparaissent** : `cohortes`, `cohorte_coachs`, `sessions`, `presences`,
`replays`. La suppression est propre — mais elle emporte toutes les politiques RLS et tous
les tests pgTAP qui s'y appuient, dont ceux du rôle coach. C'est la migration la plus
délicate du lot et elle doit être relue (`07-REPARTITION.md` : une politique RLS modifiée est
une des deux relectures qui comptent).

**Colonnes à ajouter :**

| Table          | Colonne                            | Pourquoi                                        |
| -------------- | ---------------------------------- | ----------------------------------------------- |
| `formations`   | `type_produit`                     | `abonnement` / `accompagnement` / `formation`   |
| `formations`   | `duree_acces_jours`                | 30/90/180, ou `null` = illimité (§1)            |
| `formations`   | `discord_role_id`                  | Déplacé depuis `cohortes`                       |
| `formations`   | `modalite`                         | `individuel` / `groupe` (§1)                    |
| `leads`        | `user_id`                          | Le lead a désormais toujours un compte          |
| `leads`        | `zone_geo`, `tranche_age`          | Créneaux, TVA, filtre légal des mineurs         |
| `leads`        | `niveau_trading`, `blocage`        | Segmentation et argument de vente               |
| `leads`        | `tranche_budget`, `delai_objectif` | Ce que le formateur peut proposer, et priorité  |
| `leads`        | `eligible`                         | Résultat du filtrage par le formulaire          |
| `leads`        | `produit_souhaite_id`              | Distinct de `produit_recommande_id` (§3, ét. 2) |
| `inscriptions` | `formateur_id`                     | Ancrage de la RLS formateur                     |
| `appointments` | `issue`, `compte_rendu`            | Statistiques de no-show et suivi                |

Les réponses à choix unique deviennent des **énumérations en français**, conformément aux
conventions : `zone_geo`, `tranche_age`, `niveau_trading`, `blocage_trading`,
`tranche_budget`, `delai_objectif`. Les valeurs exactes sont en annexe §9.

**Table à créer** — `propositions` : `id`, `lead_id`, `user_id`, `formation_id`,
`formateur_id`, `montant_cents`, `statut`, `expire_le`, `order_id`, `created_at`. Montant en
centimes, en entier, comme partout ailleurs.

**Aucune table de séances.** La suppression de `coaching_sessions` est confirmée : les séances
se tiennent hors plateforme (§3, étape 4 bis). C'est le seul point de la révision 3 qui a été
rouvert puis refermé à l'identique — la trace de l'aller-retour est gardée ici pour qu'il ne
se rejoue pas une troisième fois.

**Table à prévoir pour l'abonnement** — `subscriptions` : identifiant côté fournisseur,
statut, période courante, date de résiliation demandée. Un abonnement n'est pas une commande
avec une date : il a un cycle de vie propre que `orders` ne sait pas représenter.

**Ce qui ne change pas** : l'idempotence par `payment_events`, la file `discord_sync_queue`,
la RLS activée sur toute table dès sa création, `SUPABASE_SERVICE_ROLE_KEY` côté serveur
uniquement, la numérotation continue des factures, l'argent en centimes entiers.

---

## 6. Hors périmètre

Inchangé depuis `06-PERIMETRE.md` : bibliothèque d'assets, calendrier de publication, charte
graphique, espace documentaire admin, messagerie coach ↔ client. Discord fait déjà les
messages privés et les clients y sont déjà.

S'y ajoutent :

- **Les replays côté site.** Ils sont sur Discord. Le site n'héberge que de la vidéo
  marketing, sans contrôle d'accès puisqu'elle est publique par nature.
- **Les événements**, reportés après la première livraison : une liste, et « prendre son
  ticket » appelle une billetterie externe. Aucune gestion de réservation dans la plateforme.
- **La visioconférence.** Tranché par le chef de projet le 8 septembre 2026, et ça ferme le
  point 8 des points ouverts : les calls de groupe et les lives se **tiennent sur Discord**,
  dans le salon vocal du produit. Le site n'héberge aucune visio et n'émet aucun lien de
  réunion.

  Le processus actuel enchaîne trois outils non synchronisés : un lien Zoom généré à la main,
  copié-collé dans les groupes WhatsApp concernés, et un événement mis à jour sur Circle, qui
  sert de planning de référence. Le salon Discord privé remplace les deux premiers sans une
  ligne de code : `formations.discord_role_id` attribue déjà le rôle à l'inscription, la file
  le retire en fin d'accès (§3, étape 5). Pas de salle d'attente manuelle : le rôle fait ce
  filtrage sans personne derrière l'écran, et un tri humain en direct rendrait chaque call
  dépendant de la présence de celui qui trie. Détail dans `06-PERIMETRE.md`.

  **Le planning aussi est hors périmètre**, y compris celui des séances de groupe : il vit
  sur Discord, avec le reste. Circle disparaît donc en entier, sans que rien du site ne
  reprenne son rôle de calendrier (§3, étape 4 bis).

---

## 7. Ordre de construction proposé

L'ancien découpage en 7 phases était organisé autour des cohortes et des replays. Le nouveau
suit le chemin de l'argent, qui est aussi le chemin le plus court vers quelque chose
d'utilisable.

| Ordre | Contenu                                                                         |
| ----- | ------------------------------------------------------------------------------- |
| 1     | Fondations — **fait**, à corriger du §5                                         |
| 2     | Tunnel d'entrée : formulaire, création de compte, Discord `invité`, `/reserver` |
| 3     | Espace formateur : fiches, RDV, propositions                                    |
| 4     | Paiement une fois : proposition, Stripe, facture, inscription, rôle Discord     |
| 5     | Abonnement : renouvellement, échec, résiliation, révocation automatique         |
| 6     | Espace client                                                                   |
| 7     | Site public — contenu marketing, SEO, pages légales                             |
| 8     | Événements, migration des données, recette                                      |

Le paiement unique et l'abonnement sont séparés volontairement : le premier suffit à vendre
les accompagnements et les formations, c'est-à-dire les gros paniers. L'abonnement communauté
peut suivre sans bloquer la mise en service.

Dépendance à débloquer tôt : **aucune application Discord n'existe encore** (voir
`apps/bot/README.md`). Le worker est écrit mais n'a jamais tourné en réel. Il est bloquant à
partir de l'étape 2.

---

## 8. Points ouverts

1. **Les règles d'éligibilité.** Le formulaire affiche « ton profil est éligible », donc une
   règle existe déjà côté Tally. Laquelle ? Et qu'affiche-t-on à quelqu'un qui n'est pas
   éligible ? Sans la réponse, le tunnel ne peut pas être reconstruit à l'identique.
2. **L'abonnement communauté passe-t-il par l'audit ?** Toujours ouvert, mais la direction
   s'est précisée le 8 septembre 2026 : il y aura **deux abonnements**, un accès communautaire
   premium sur Discord et un accès à des **vidéos exclusives**. C'est neuf pour l'équipe, qui
   n'a pas encore de visibilité sur le contenu exact. Deux conséquences pour nous.

   La première est sans effet : le schéma porte déjà les deux sans rien ajouter — deux lignes
   `formations` en `type_produit = 'abonnement'`, chacune avec son `discord_role_id`, et un
   client peut détenir les deux puisque la révocation se raisonne par inscription, jamais par
   personne.

   La seconde ne l'est pas : **où vivent les vidéos exclusives ?** Sur Discord, il n'y a rien
   à construire. Sur le site, la règle « jamais d'URL de vidéo en base » se réveille, et avec
   elle le lecteur à accès restreint et les URL signées que §6 avait justement retirés du
   périmètre — ce qui était « le plus gros retrait de la révision 3 » reviendrait par la
   fenêtre. À poser avant la phase 5.

   La recommandation sur le tunnel, elle, ne change pas : achat direct depuis
   `/formations/[slug]`, l'audit restant réservé aux accompagnements et aux formations.
   Entorse assumée au « un seul tunnel » de `02-SITEMAP.md`, et elle mérite d'être décidée
   plutôt que subie.

3. **Paiement en plusieurs fois — tranché le 8 septembre 2026 : non.** Tout se paie en une
   fois. `payment_schedules`, `orders.echelonne` et les colonnes d'échelonnement du catalogue
   ont été supprimées (`20260908095000_a_paiement_une_fois.sql`). La remarque de fond reste
   vraie — sur des paniers à plus de 5 000 €, le 3× est courant dans ce marché — mais c'est
   désormais une décision, pas un oubli, et elle se rouvre par une migration.
4. **TVA et facturation hors Europe.** Le formulaire demande la zone géographique et accepte
   Amérique, Asie, Océanie, Afrique. Vendre de la formation en ligne hors UE ne se facture
   pas comme en France. Question pour le comptable, pas pour les développeurs — mais elle
   doit être posée avant la première facture, pas après.
5. **Vérification de l'email** — proposition : non bloquante pour la prise de RDV, bloquante
   avant le paiement. Une facture part vers une adresse non vérifiée sinon.
6. **Remise accordée par le formateur** — autorisée ? Si oui, plafond, et journalisation dans
   `audit_logs`.
7. **Délai de grâce** en fin d'accès avant coupure du rôle Discord, et comportement en cas
   d'échec de prélèvement d'un abonnement.

Un huitième point figurait ici — les conférences et lives, planifiés depuis le site ou annoncés
sur Discord ? Il a été tranché le 8 septembre 2026, donc retiré de cette liste : Discord, et
rien côté site. Voir §6.

### Décisions prises et déléguées

Consignées ici pour qu'on ne les rouvre pas sans raison. Le 8 septembre 2026, sur délégation
explicite du chef de projet : **Cal.com** plutôt que Calendly (§3, étape 2), **refus dur des
moins de 18 ans**, **consentement RGPD explicite**, **nom de famille collecté au paiement**
(§3, étape 1). Le même jour, tranché par le chef de projet lui-même : **les calls de groupe
sur Discord**, sans salle d'attente manuelle (§6), et **la distinction individuel / groupe
portée par `formations.modalite`**, les séances elles-mêmes restant hors plateforme — les
formateurs les organisent entre eux et avec le client (§1 et §3, étape 4 bis). Le reste des
recommandations de ce document — la proposition émise
depuis `/formateur`, l'absence de choix de produit avant l'audit, l'affectation explicite
comme périmètre du formateur — reste soumis à arbitrage.

---

## 9. Annexe — le formulaire de qualification

Relevé sur le formulaire Tally en production (`https://tally.so/r/kdABWd`, « 2 minutes pour
comprendre où tu en es dans ton trading »). **Toutes les questions sont obligatoires.** Les
valeurs d'énumération à créer en base sont données entre parenthèses.

**Écran 1 — Identité**

| Question                                      | Type         | Options                                                                                       |
| --------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| Quel est ton prénom ?                         | Texte court  | —                                                                                             |
| Quelle est ton adresse email ?                | Email        | —                                                                                             |
| Quel est ton numéro de téléphone ?            | Téléphone    | —                                                                                             |
| Dans quelle zone géographique es-tu basé(e) ? | Choix unique | Europe, Amérique, Asie, Océanie, Afrique (`europe`, `amerique`, `asie`, `oceanie`, `afrique`) |

**Écran 2 — Âge**

| Question         | Type         | Options                                                                                             |
| ---------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| Quel âge as-tu ? | Choix unique | Moins de 18 ans, 18-25, 25-35, 35-50, Plus de 50 (`moins_18`, `18_25`, `25_35`, `35_50`, `plus_50`) |

**Écran 3 — Situation professionnelle**

| Question                                  | Type         | Options                                                                                                                                           |
| ----------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quelle est ta situation professionnelle ? | Choix unique | Salarié, Indépendant / Chef d'entreprise, Étudiant / Alternant / CDD / Intérim, Sans emploi (`salarie`, `independant`, `etudiant`, `sans_emploi`) |

**Écran 4 — Niveau**

| Question                                | Type         | Options                                                                                                                                                                           |
| --------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Où en es-tu dans ton parcours trading ? | Choix unique | Je découvre, je ne me suis jamais lancé · Débutant, j'ai déjà passé quelques trades · Intermédiaire · Avancé, plus de 2 ans (`decouverte`, `debutant`, `intermediaire`, `avance`) |

**Écran 5 — Qualification commerciale**

| Question                                                 | Type         | Options                                                                                                                                                                                                                       |
| -------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| As-tu une prop firm actuellement ?                       | Liste        | Non, En cours de challenge, Oui (`non`, `en_challenge`, `oui`)                                                                                                                                                                |
| Aujourd'hui, quel est ton plus gros blocage ?            | Choix unique | Stratégie (quand entrer/sortir) · Discipline et psychologie (plan non respecté) · Gestion du risque (drawdown, taille de position, pertes) · Réussir une prop firm (`strategie`, `discipline`, `gestion_risque`, `prop_firm`) |
| Quel budget es-tu prêt à investir dans ton parcours ?    | Choix unique | 500-1000 €, 1000-2000 €, 2000-5000 €, Plus de 5000 € (`500_1000`, `1000_2000`, `2000_5000`, `plus_5000`)                                                                                                                      |
| Dans quel délai souhaiterais-tu atteindre ton objectif ? | Choix unique | Le plus rapidement possible, D'ici le mois prochain, Dans les 3 prochains mois (`immediat`, `mois_prochain`, `trois_mois`)                                                                                                    |

**Écran final** — « Bonne Nouvelle ! Ton profil est éligible. Tu peux maintenant planifier ton
audit. » suivi de l'invitation à réserver et du calendrier Calendly embarqué.

### Ce que la version reconstruite change

Le relevé ci-dessus est la source de vérité pour les **questions**. Le déroulé, lui, diffère
sur quatre points arbitrés (§3, étape 1) :

| Écran         | Version Tally                    | Version reconstruite                                                                          |
| ------------- | -------------------------------- | --------------------------------------------------------------------------------------------- |
| Âge (écran 2) | Question posée, sans conséquence | **Écran isolé et bloquant.** « Moins de 18 ans » arrête tout, avant toute écriture en base    |
| Dernier écran | Aucun consentement               | **Case RGPD** non pré-cochée + lien vers la politique, enregistrée dans `consents`            |
| Écran final   | Calendly embarqué                | Création du compte, rôle Discord `invité`, redirection vers `/reserver` (Cal.com)             |
| Non éligible  | Cas non traité visiblement       | Message dédié, compte et communauté conservés, pas de créneau proposé — reste à écrire (§8.1) |

Le nom de famille n'est **pas** ajouté ici : il se collecte au paiement, là où la facturation
l'exige réellement.
