# Structure du site — ApexCompany (révision 3)

Révision suite aux précisions du chef de projet du 8 septembre 2026. Le parcours qui justifie
cette arborescence est décrit dans `01-CAHIER-DES-CHARGES.md` ; ce document ne fait qu'en
donner la carte.

Deux principes tiennent tout : **aucune page de contenu de formation** — les cours sont en
live sur Discord, et les replays y restent — et **le compte est créé avant la vente**, à la
sortie du formulaire de qualification.

## 1. Site public

```
/                           Accueil — point d'entrée unique des réseaux sociaux
/formations                 Catalogue — abonnement, accompagnements, formations
/formations/[slug]          Fiche produit
/qualification              Formulaire de qualification — crée le compte
/reserver                   Choix du formateur et du créneau (Cal.com)
/formateurs                 L'équipe
/faq
/contact
/evenements                 Reporté après la première livraison

/mentions-legales  /cgv  /confidentialite  /cookies  /remboursement  /accessibilite
```

**Le lien unique des réseaux.** Le besoin d'« un lien stable à mettre en avant » se règle avec
la racine du domaine, plus des paramètres de source (`?src=ig`, `?src=yt`, `?src=tt`) capturés
au premier contact et stockés sur le lead. Pas de page-relais type Linktree : chaque
redirection perd du monde, et vous voulez savoir quel réseau convertit réellement.

**Le tunnel a un seul chemin, et il commence par le formulaire.** `/qualification` est la
porte d'entrée de tout ce qui suit : il crée le compte, attribue le rôle Discord `invité` et
ouvre l'accès à `/reserver`. Les fiches produit servent à convaincre, pas à acheter — sauf
peut-être l'abonnement communauté, dont la vente en self-service est un point ouvert
(`01-CAHIER-DES-CHARGES.md` §8.2).

**`/evenements` est reporté** après la première livraison : une liste d'événements, et
« prendre son ticket » appelle une billetterie externe. Aucune gestion de réservation dans la
plateforme.

## 2. Espace client

Léger, puisque le contenu est ailleurs.

```
/espace                     Ses accès en cours, lien Discord, prochain RDV
/espace/rendez-vous         Rendez-vous passés et à venir
/espace/propositions/[id]   Proposition reçue après l'audit → paiement
/espace/factures            Factures, échéances, gestion de l'abonnement
/espace/compte              Informations personnelles
/espace/communaute          État de la liaison Discord, lien d'accès
```

Pas de messagerie : l'échange conversationnel reste sur Discord (voir `06-PERIMETRE.md`).

**`/espace/propositions/[id]` est une page authentifiée, pas un lien à jeton.** C'est le
bénéfice direct du compte créé tôt : la RLS protège la proposition, sans mécanisme de
signature à inventer.

**Aucune page de planning, et aucun écran de réservation de séance.** Après l'achat, les
séances individuelles s'organisent directement entre le formateur et son client, et les
séances de groupe sont annoncées sur Discord, dans le salon du produit
(`01-CAHIER-DES-CHARGES.md` §3, étape 4 bis). **Cal.com ne sert qu'au premier rendez-vous**,
l'audit de vente. Le site n'affiche jamais de lien de visioconférence.

Un client qui cumule deux inscriptions voit ses deux accès dans `/espace`, comme partout
ailleurs.

**`/espace/factures` doit permettre de résilier l'abonnement.** Un abonnement qu'on ne peut
annuler que par email est une source de litige, et selon les cas une non-conformité.

**Un client peut cumuler plusieurs accès** — abonnement communauté et accompagnement, par
exemple. Deux inscriptions, deux rôles Discord, deux dates de fin indépendantes. L'interface
doit le prévoir dès `/espace`.

## 3. Espace formateur

Zone dédiée, pas un back-office dégradé. Le formateur a un métier et des écrans qui lui
correspondent ; le mélanger au back-office obligerait chaque page d'administration à masquer
la moitié de son contenu pour toujours.

```
/formateur                  Tableau de bord : RDV du jour, à venir, propositions en attente
/formateur/rendez-vous      Audits passés et à venir, issue et compte rendu
/formateur/clients          Ses clients et ses prospects
/formateur/clients/[id]     Réponses au formulaire, historique, RDV, notes, statut d'accès
/formateur/statistiques     RDV honorés, no-show, propositions émises, conversion
```

La fiche client affiche en tête ce que le formulaire a capté — **budget déclaré, blocage
principal, niveau, délai**. C'est ce qui prépare l'appel, et c'est disponible gratuitement
puisque la personne vient de le saisir.

**Jamais un montant sur ces écrans.** Ni prix payé, ni facture, ni impayé. Le formateur voit
si l'accès est actif, pas ce qu'il a coûté.

## 4. Back-office

```
/admin                      CA, inscriptions, RDV du jour, alertes webhooks

/admin/crm
  /leads                    Pipeline : nouveau → contacté → RDV → proposition → gagné/perdu
  /leads/[id]               Historique, notes, RDV, propositions
/admin/clients
  /[id]                     Inscriptions, paiements, suivi formateur, Discord

/admin/formations           Catalogue, types de produit, tarifs, statut
/admin/propositions         Propositions émises, en attente, expirées
/admin/abonnements          Abonnements actifs, renouvellements, échecs de prélèvement

/admin/paiements
  /transactions             Stripe + PayPal unifiés
  /echeances                Paiements échelonnés en cours
  /remboursements
  /litiges

/admin/documents            Factures, attestations générées
/admin/emails               Modèles transactionnels
/admin/utilisateurs         Comptes et rôles                      [admin, owner]
/admin/logs                 Automatisations et webhooks           [admin, owner]
/admin/audit                Actions sensibles                     [owner]
/admin/parametres                                                 [owner]
```

Disparaissent de la révision 2 : `/admin/cohortes`, `/admin/sessions` et `/admin/coaching`.
Le parcours est individuel, il n'y a plus de promotions ni d'émargement.

## Matrice d'accès

| Section                     |    Client     |    Formateur     | Branding | Admin | Owner |
| --------------------------- | :-----------: | :--------------: | :------: | :---: | :---: |
| Espace client (ses données) |       ✓       |        —         |    —     |   —   |   —   |
| Espace formateur            |       —       | ses affectations |    —     |   —   |   —   |
| CRM leads                   |       —       |        —         |    —     |   ✓   |   ✓   |
| Fiches clients              |       —       | ses affectations |    —     |   ✓   |   ✓   |
| Notes de suivi              |       —       | ses affectations |    —     |   ✓   |   ✓   |
| Rendez-vous                 |   les siens   |    les siens     |    —     |   ✓   |   ✓   |
| Propositions                | celles reçues |  celles émises   |    —     |   ✓   |   ✓   |
| Catalogue et tarifs         |    lecture    |     lecture      | lecture  |   ✓   |   ✓   |
| Paiements et abonnements    | ses factures  |        —         |    —     |   ✓   |   ✓   |
| Remboursements              |       —       |        —         |    —     |   ✓   |   ✓   |
| Statistiques de conversion  |       —       |   les siennes    | lecture  |   ✓   |   ✓   |
| Gestion des rôles           |       —       |        —         |    —     |   —   |   ✓   |
| Logs et audit               |       —       |        —         |    —     |   ✓   |   ✓   |

Un formateur ne voit **jamais** les données financières d'un client, ni les clients d'un autre
formateur. Ces deux règles sont des politiques RLS, pas des filtres d'affichage.

**« Ses affectations » remplace « sa cohorte ».** Sans cohortes, le périmètre du formateur
s'ancre sur `inscriptions.formateur_id` et `leads.assigned_to` — une affectation explicite, et
non une dérivation depuis les rendez-vous passés, qui élargirait le périmètre en silence à
chaque RDV repris d'un collègue absent. Voir `04-DATA-MODEL.md`.
