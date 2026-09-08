# Structure du site — ApexCompany (révision 2)

Révision suite aux précisions du chef de projet : **aucune page de contenu de formation.**
Les cours sont dispensés en live sur Discord. Le site sert à convertir, l'espace client sert
à s'orienter et à accéder aux replays, le back-office porte l'essentiel de la valeur.

## 1. Site public

```
/                           Accueil — point d'entrée unique des réseaux sociaux
/methode                    L'approche pédagogique
/offres                     Catalogue
/offres/[slug]              Fiche offre
/coachs                     L'équipe
/evenements                 Événements présentiels
/faq
/reserver                   Prise de rendez-vous (Cal.com)
/contact

/mentions-legales  /cgv  /confidentialite  /cookies  /remboursement  /accessibilite
```

**Le lien unique des réseaux.** Le besoin d'« un lien stable à mettre en avant » se règle avec
la racine du domaine, plus des paramètres de source (`?src=ig`, `?src=yt`, `?src=tt`) capturés
au premier contact et stockés sur le lead. Pas de page-relais type Linktree : chaque
redirection perd du monde, et vous voulez savoir quel réseau convertit réellement.

**Un seul tunnel.** Toutes les offres passent par le même chemin : fiche offre → réservation
d'échange → qualification → lien de paiement. Pas de funnel parallèle par offre, c'est
précisément ce qui a créé la dispersion actuelle.

## 2. Espace client

Beaucoup plus léger qu'initialement prévu, puisque le contenu est ailleurs.

```
/espace                     Prochaine session, accès au salon de sa cohorte, dernier replay
/espace/planning            Calendrier des sessions de sa cohorte
/espace/replays             Enregistrements accessibles, lecteur sécurisé
/espace/coaching            Réservation de créneaux individuels (Cal.com)
/espace/suivi               Objectifs et retours du coach — lecture seule
/espace/communaute          État de la liaison Discord, lien d'accès
/espace/compte              Profil, factures, échéances de paiement
```

Pas de messagerie : l'échange conversationnel reste sur Discord (voir `06-PERIMETRE.md`).

**`/espace/planning` est le calendrier de référence**, à la place de Circle. Il lit `sessions`
et rien d'autre : pas de calendrier tenu en parallèle ailleurs, sinon les deux divergent et
personne ne sait plus lequel fait foi. Les calls de groupe s'y affichent avec le salon vocal
privé de la cohorte — jamais un lien de visio généré à la main (voir `06-PERIMETRE.md`,
« Calls de groupe »).

**`/espace/replays` est la seule page techniquement délicate du front client.** L'URL de la
vidéo doit être signée côté serveur, à durée courte, après vérification que l'inscription est
active. Ne jamais exposer d'URL de fichier directe.

## 3. Back-office

```
/admin                      CA, inscriptions, RDV du jour, alertes webhooks

/admin/crm
  /leads                    Pipeline : nouveau → contacté → RDV → proposition → gagné/perdu
  /leads/[id]               Historique, notes, RDV, propositions
/admin/clients
  /[id]                     Inscriptions, paiements, présences, suivi coach, Discord

/admin/offres               Catalogue, tarifs, statut
/admin/cohortes             Groupes, places, dates
/admin/sessions             Planning live, émargement, dépôt des replays
/admin/coaching             Créneaux individuels

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

## Matrice d'accès

| Section                     |        Client         |    Coach     | Branding | Admin | Owner |
| --------------------------- | :-------------------: | :----------: | :------: | :---: | :---: |
| Espace client (ses données) |           ✓           |      —       |    —     |   —   |   —   |
| CRM leads                   |           —           |      —       |    —     |   ✓   |   ✓   |
| Fiches clients              |           —           |  sa cohorte  |    —     |   ✓   |   ✓   |
| Notes de suivi              | lecture (les siennes) |  sa cohorte  |    —     |   ✓   |   ✓   |
| Sessions et présences       |           —           | ses sessions |    —     |   ✓   |   ✓   |
| Dépôt de replays            |           —           | ses sessions |    —     |   ✓   |   ✓   |
| Catalogue et tarifs         |           —           |   lecture    | lecture  |   ✓   |   ✓   |
| Paiements                   |     ses factures      |      —       |    —     |   ✓   |   ✓   |
| Remboursements              |           —           |      —       |    —     |   ✓   |   ✓   |
| Statistiques de conversion  |           —           |      —       | lecture  |   ✓   |   ✓   |
| Gestion des rôles           |           —           |      —       |    —     |   —   |   ✓   |
| Logs et audit               |           —           |      —       |    —     |   ✓   |   ✓   |

Un coach ne voit **jamais** les données financières d'un client, ni les clients d'un autre
coach. Ces deux règles sont des politiques RLS.
