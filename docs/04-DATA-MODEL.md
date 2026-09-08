# Modèle de données — révision 3

Changements par rapport à la révision 2, tous issus de `01-CAHIER-DES-CHARGES.md` :
suppression des cohortes, des sessions, des présences et des replays ; renommage de `offres`
en `formations` et du rôle `coach` en `formateur` ; trois types de produit aux mécaniques
d'accès distinctes ; arrivée des propositions et des abonnements.

**Attention en lisant ce document.** Le schéma réellement appliqué est encore celui de la
révision 2 : les neuf migrations de `supabase/migrations/` décrivent des cohortes. Ce document
décrit la cible. Les écarts sont signalés par ⚠️ **à écrire**.

## Identité et rôles

**`profiles`** — `id` (FK auth.users), `email`, `prenom`, `nom`, `telephone`, `avatar_url`, `created_at`

`nom` reste vide à la création du compte : le formulaire de qualification ne demande que le
prénom. Il se remplit au paiement, où la facturation l'exige.

**`user_roles`** — `id`, `user_id`, `role`, `granted_by`, `granted_at`

⚠️ **à écrire** : l'énumération devient `client`, `formateur`, `branding`, `admin`, `owner`.
La valeur `coach` est renommée.

**Ces rôles n'ont rien à voir avec les rôles Discord.** `user_roles` décide de ce qu'une
requête peut lire ; les rôles Discord décident du contenu visible sur le serveur. Le rôle
`invité`, attribué à la création du compte, est un rôle **Discord** : côté site, cette
personne est un `client` sans inscription active. Voir `01-CAHIER-DES-CHARGES.md` §2.

## Commercial

**`leads`** — `id`, `email`, `prenom`, `nom`, `telephone`, `source` (`instagram`, `youtube`,
`tiktok`, `snapchat`, `direct`, `parrainage`), `utm` (jsonb), `statut`, `assigned_to`,
`created_at`, `updated_at`

Le champ `source` répond directement au besoin du pôle branding : savoir quel réseau convertit.
Il est renseigné au premier contact et ne doit jamais être écrasé ensuite.

⚠️ **à écrire** — colonnes issues du formulaire de qualification :

| Colonne                 | Type                                                     |
| ----------------------- | -------------------------------------------------------- |
| `user_id`               | FK profiles, unique — tout lead a désormais un compte    |
| `zone_geo`              | `europe`, `amerique`, `asie`, `oceanie`, `afrique`       |
| `tranche_age`           | `18_25`, `25_35`, `35_50`, `plus_50`                     |
| `niveau_trading`        | `decouverte`, `debutant`, `intermediaire`, `avance`      |
| `blocage`               | `strategie`, `discipline`, `gestion_risque`, `prop_firm` |
| `tranche_budget`        | `500_1000`, `1000_2000`, `2000_5000`, `plus_5000`        |
| `delai_objectif`        | `immediat`, `mois_prochain`, `trois_mois`                |
| `eligible`              | booléen — résultat du filtrage par le formulaire         |
| `produit_souhaite_id`   | FK formations — déclaré par le prospect                  |
| `produit_recommande_id` | FK formations — retenu par le formateur après l'audit    |

`tranche_age` ne contient **pas** `moins_18` : un mineur est refusé avant toute écriture en
base, il ne devient jamais un lead. Une valeur d'énumération qui ne peut pas exister en base
n'a pas à y être déclarée.

`produit_souhaite_id` et `produit_recommande_id` sont deux données distinctes et le restent :
« suivant comment se passe le RDV la formation peut changer ». Les fusionner ferait
disparaître l'écart entre ce que les gens croient vouloir et ce qu'on leur vend.

**`lead_events`** — historique immuable : `id`, `lead_id`, `type`, `payload` (jsonb), `created_by`, `created_at`

Reçoit notamment la soumission **complète** du formulaire, en jsonb, sous le type
`formulaire_soumis`. Les colonnes de `leads` ci-dessus en sont une projection destinée au tri
et au filtrage ; l'original vit ici, et reste lisible même si les questions changent.

**`appointments`** — `id`, `lead_id`, `cal_booking_id`, `debut`, `fin`, `statut`, `conseiller_id`

⚠️ **à écrire** : `issue` (`honore`, `absent`, `annule`) et `compte_rendu`. Sans `issue`, pas
de statistique de no-show — le premier poste de perte d'un tunnel de vente par appel.

`cal_booking_id` reste : le calendrier retenu est **Cal.com** (`01-CAHIER-DES-CHARGES.md`
§3, étape 2).

⚠️ **à écrire** — **`propositions`** : `id`, `lead_id`, `user_id`, `formation_id`,
`formateur_id`, `montant_cents`, `statut`, `expire_le`, `order_id`, `created_at`

Ce que le formateur émet à la fin de l'audit, à la place d'un lien de paiement collé à la
main. C'est la table qui rend la conversion mesurable : qui a proposé quoi, à quel prix, et
est-ce que ça a été payé.

## Catalogue

⚠️ **à écrire** — **`formations`** (ex-`offres`) — `id`, `slug`, `titre`, `description`,
`objectifs_pedagogiques`, `prerequis`, `duree_semaines`, `volume_horaire`, `prix_cents`,
`actif`, `ordre`, plus :

| Colonne             | Rôle                                                        |
| ------------------- | ----------------------------------------------------------- |
| `type_produit`      | `abonnement`, `accompagnement`, `formation`                 |
| `duree_acces_jours` | 30 / 90 / 180 pour un accompagnement, **`null` = illimité** |
| `discord_role_id`   | Le rôle Discord à attribuer — déplacé depuis `cohortes`     |

**Trois types de produit, une seule mécanique d'accès.** C'est l'invariant central de la
révision 3 :

| Type             | Paiement          | `date_fin_acces`                         |
| ---------------- | ----------------- | ---------------------------------------- |
| `abonnement`     | Récurrent mensuel | Repoussée d'un mois à chaque prélèvement |
| `accompagnement` | Une fois          | `date_debut + duree_acces_jours`         |
| `formation`      | Une fois          | `null` — jamais révoquée                 |

Le worker Discord lit une date. Il n'a pas à savoir ce qui a été vendu, et il ne doit jamais
apprendre à le savoir : c'est ce qui permet de n'avoir qu'un seul mécanisme de révocation
pour trois modèles économiques.

**Tables supprimées** : `cohortes`, `cohorte_coachs`. Le parcours est individuel.

## Inscriptions et suivi

**`inscriptions`** — `id`, `user_id`, `formation_id`, `statut` (`active`, `suspendue`,
`terminee`, `remboursee`), `date_debut`, `date_fin_acces`, `order_id`

⚠️ **à écrire** : `formateur_id`, et suppression de `cohorte_id`.

`formateur_id` est le nouvel ancrage de sécurité du rôle formateur — voir la RLS plus bas.

**`suivi_notes`** — `id`, `inscription_id`, `formateur_id`, `type` (`objectif`, `observation`,
`retour`), `contenu`, `visible_client`, `created_at`

Le champ `visible_client` sépare les notes internes des retours destinés au client. Une note
interne mal cloisonnée qui remonte dans l'espace client est le genre d'incident qui coûte cher.
En v1 les notes restent internes à `/formateur` : aucun écran client ne les lit encore, mais
la colonne reste, parce que la RLS qui la protège doit exister avant l'écran qui l'utilisera.

**Tables supprimées** : `sessions`, `presences`, `replays`, `coaching_sessions`. Les lives et
les replays sont sur Discord ; l'émargement n'a plus d'objet sans promotions.

## Paiement

**`orders`** — `id`, `user_id`, `lead_id`, `formation_id`, `montant_cents`, `devise`, `statut`,
`provider` (`stripe` / `paypal`), `provider_order_id`, `echelonne`, `created_at`

**`payments`** — `id`, `order_id`, `montant_cents`, `statut`, `provider`, `provider_payment_id`,
`methode`, `paid_at`

**`payment_schedules`** — échéances des paiements échelonnés
`id`, `order_id`, `numero_echeance`, `montant_cents`, `date_prevue`, `statut`, `payment_id`

Inutilisée en l'état : le chef de projet annonce des paiements en une fois. Conservée en
attendant l'arbitrage sur le 3× (`01-CAHIER-DES-CHARGES.md` §8.3).

⚠️ **à écrire** — **`subscriptions`** : `id`, `user_id`, `formation_id`, `provider`,
`provider_subscription_id`, `statut`, `periode_fin`, `resiliation_demandee_le`, `created_at`

Un abonnement n'est pas une commande avec une date de fin : il a un cycle de vie propre —
renouvellements, échecs de prélèvement, résiliation à effet différé — que `orders` ne sait pas
représenter. Chaque renouvellement réussi repousse `inscriptions.date_fin_acces` d'un mois.

**`payment_events`** — **garantit l'idempotence**
`id`, `provider`, `provider_event_id` (**UNIQUE**), `type`, `payload` (jsonb), `traite_at`, `erreur`

La contrainte d'unicité sur `provider_event_id` est ce qui empêche un webhook rejoué de créer
deux inscriptions. Le handler insère d'abord ici ; si l'insertion échoue sur la contrainte,
l'événement a déjà été traité et on s'arrête. Vaut aussi pour les renouvellements
d'abonnement : un événement rejoué ne doit pas offrir deux mois d'accès.

**`invoices`** — `id`, `order_id`, `numero` (séquence continue, obligation légale), `pdf_url`, `emise_at`

**`refunds`** — `id`, `payment_id`, `montant_cents`, `motif`, `statut`, `demande_par`, `traite_par`, `traite_at`

**`disputes`** — `id`, `payment_id`, `provider_dispute_id`, `montant_cents`, `statut`, `deadline_reponse`

## Discord

**`discord_links`** — `id`, `user_id`, `discord_user_id` (UNIQUE), `roles_attribues` (jsonb),
`linked_at`, `derniere_sync`

**`discord_sync_queue`** — `id`, `user_id`, `action` (`grant`, `revoke`), `role_id`, `statut`,
`tentatives`, `erreur`, `created_at`

Une file, pas un appel direct. L'API Discord est limitée en débit et peut être indisponible ;
sans file, un paiement pendant une coupure Discord donne un client sans accès et aucune trace.

⚠️ **à écrire** — **la révocation automatique**. Une tâche planifiée quotidienne cherche les
inscriptions dont `date_fin_acces` est dépassée, les passe en `terminee` et empile un `revoke`.
Les lignes à `date_fin_acces null` ne sont jamais sélectionnées — c'est ce qui donne aux
formations leur accès illimité, sans cas particulier dans le code.

La révocation se raisonne **par inscription, jamais par personne** : un client qui perd son
accompagnement mais garde son abonnement communauté ne doit perdre que le rôle correspondant.

## Traçabilité

**`automation_logs`** — `id`, `declencheur`, `entite_type`, `entite_id`, `statut`, `details` (jsonb), `created_at`

**`audit_logs`** — `id`, `user_id`, `action`, `table_cible`, `enregistrement_id`, `avant` (jsonb),
`apres` (jsonb), `ip`, `created_at`

**`consents`** — `id`, `user_id` ou `email`, `type`, `accorde`, `version_texte`, `ip`, `created_at`

Rempli à la soumission du formulaire de qualification. `version_texte` n'est pas décoratif :
sans lui, on ne peut pas prouver à quoi la personne a consenti le jour où elle le demande.

## RLS — les trois politiques qui comptent

RLS activée sur toutes les tables sans exception. Une table sans politique est inaccessible :
c'est le bon défaut.

```sql
create or replace function public.has_role(r text)
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.user_roles
                 where user_id = auth.uid() and role = r);
$$;
```

⚠️ **à écrire** — `coach_de_cohorte()` disparaît avec les cohortes. Son remplaçant s'appuie
sur l'affectation explicite :

```sql
-- Un formateur n'accède qu'aux clients qui lui sont affectés
create or replace function public.formateur_de_inscription(i uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.inscriptions
                 where id = i and formateur_id = auth.uid());
$$;
```

**Pourquoi une affectation explicite et pas une dérivation depuis `appointments`.** « Il a eu
un appel avec cette personne un jour » paraît plus simple, mais élargit le périmètre en
silence à chaque rendez-vous repris d'un collègue absent, et ne se teste pas proprement : le
périmètre devient une conséquence de l'historique au lieu d'être une décision.

**Politique 1 — le client voit ses données.**
`using (user_id = auth.uid())`

**Politique 2 — le formateur voit ses affectations, et rien d'autre.**

```sql
create policy formateur_lit_inscriptions on inscriptions for select
using (formateur_id = auth.uid() or has_role('admin') or has_role('owner'));
```

Notez l'absence de `client` : un client ne lit pas les inscriptions des autres, il passe par
la politique 1.

**Politique 3 — les données financières sont fermées aux formateurs.**
Sur `orders`, `payments`, `subscriptions`, `refunds`, `disputes`, `propositions.montant_cents` :
`using (has_role('admin') or has_role('owner'))`, plus une politique séparée permettant au
client de lire ses propres factures et propositions.

**Indexez les colonnes utilisées dans les politiques** — `inscriptions.formateur_id`,
`inscriptions.user_id`, `leads.assigned_to`, `leads.user_id`. Une politique s'évalue ligne à
ligne ; sans index, les performances s'effondrent dès quelques milliers de lignes.

**Testez chaque politique avec un jeu de données de chaque rôle.** Une politique jamais testée
est une politique fausse. `supabase/seed.sql` doit contenir un utilisateur de chaque rôle et
**deux formateurs avec des clients distincts**, précisément pour vérifier qu'un formateur ne
voit pas les clients de l'autre. C'est l'équivalent, sans cohortes, du jeu de test à deux
promotions de la révision 2.
