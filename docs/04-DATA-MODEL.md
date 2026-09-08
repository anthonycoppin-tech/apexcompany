# Modèle de données — révision 2

Changements par rapport à la v1 : suppression de `modules`, `ressources` et de la progression
par module (les cours sont en live sur Discord). Ajout de `replays`, `suivi_notes`, et passage
à 5 rôles.

## Identité et rôles

**`profiles`** — `id` (FK auth.users), `email`, `prenom`, `nom`, `telephone`, `avatar_url`, `created_at`

**`user_roles`** — `id`, `user_id`, `role` (enum : `client`, `coach`, `branding`, `admin`, `owner`),
`granted_by`, `granted_at`

## Commercial

**`leads`** — `id`, `email`, `prenom`, `nom`, `telephone`, `source` (`instagram`, `youtube`,
`tiktok`, `snapchat`, `direct`, `parrainage`), `utm` (jsonb), `statut`, `offre_recommandee_id`,
`assigned_to`, `created_at`, `updated_at`

Le champ `source` répond directement au besoin du pôle branding : savoir quel réseau convertit.
Il est renseigné au premier contact et ne doit jamais être écrasé ensuite.

**`lead_events`** — historique immuable : `id`, `lead_id`, `type`, `payload` (jsonb), `created_by`, `created_at`

**`appointments`** — `id`, `lead_id`, `cal_booking_id`, `debut`, `fin`, `statut`, `conseiller_id`

## Catalogue et cohortes

**`offres`** — `id`, `slug`, `titre`, `description`, `objectifs_pedagogiques`, `prerequis`,
`duree_semaines`, `volume_horaire`, `prix_cents`, `paiement_echelonne_possible`, `actif`, `ordre`

**`cohortes`** — `id`, `offre_id`, `nom`, `date_debut`, `date_fin`, `places_max`, `statut`,
`discord_role_id`

`discord_role_id` fait le lien entre la cohorte et le rôle Discord à attribuer. C'est ce champ
qui rend la synchronisation automatique possible.

**`cohorte_coachs`** — `cohorte_id`, `coach_id`
Table de liaison. **C'est elle qui porte toute la sécurité du rôle coach** : les politiques RLS
s'appuient dessus pour déterminer ce qu'un coach a le droit de voir.

## Inscriptions et suivi

**`inscriptions`** — `id`, `user_id`, `offre_id`, `cohorte_id`, `statut` (`active`, `suspendue`,
`terminee`, `remboursee`), `date_debut`, `date_fin_acces`, `order_id`

**`sessions`** — `id`, `cohorte_id`, `titre`, `type` (`live`, `call_groupe`), `debut`, `fin`,
`coach_id`, `lien_discord`, `statut`

`lien_discord` pointe vers le salon vocal privé de la cohorte, pas vers un lien généré à la
volée : le salon est permanent, son accès est déjà cloisonné par `discord_role_id`
(`cohortes`). Ce champ remplace Circle (planning) et Zoom (lien de call) — voir
`06-PERIMETRE.md`, « Calls de groupe ».

**À trancher en phase 5** : le salon étant permanent et propre à la cohorte, la même valeur se
répète sur chaque session. Un `cohortes.discord_channel_id` serait le bon emplacement, et
`sessions.lien_discord` ne garderait alors que les exceptions (une session tenue ailleurs). Ne
pas migrer avant d'avoir vu un vrai serveur Discord : c'est le test réel du bot qui dira si un
salon par cohorte suffit ou s'il en faut un par type de session.

**`presences`** — `id`, `session_id`, `inscription_id`, `present`, `duree_minutes`, `saisi_par`

**`replays`** — `id`, `session_id`, `provider`, `provider_asset_id`, `duree_secondes`,
`publie`, `disponible_jusqu_au`, `uploaded_by`, `created_at`

On ne stocke **jamais** d'URL de lecture ici, seulement l'identifiant chez l'hébergeur vidéo.
L'URL signée est générée à la demande, côté serveur, après vérification de l'inscription.

**`suivi_notes`** — suivi individuel par le coach
`id`, `inscription_id`, `coach_id`, `type` (`objectif`, `observation`, `retour`),
`contenu`, `visible_client` (booléen), `created_at`

Le champ `visible_client` sépare les notes internes des retours destinés au client. Une note
interne mal cloisonnée qui remonte dans l'espace client est le genre d'incident qui coûte cher.

**`coaching_sessions`** — créneaux individuels
`id`, `inscription_id`, `coach_id`, `cal_booking_id`, `debut`, `fin`, `statut`, `compte_rendu`

## Paiement

**`orders`** — `id`, `user_id`, `lead_id`, `offre_id`, `montant_cents`, `devise`, `statut`,
`provider` (`stripe` / `paypal`), `provider_order_id`, `echelonne`, `created_at`

**`payments`** — `id`, `order_id`, `montant_cents`, `statut`, `provider`, `provider_payment_id`,
`methode`, `paid_at`

**`payment_schedules`** — échéances des paiements échelonnés
`id`, `order_id`, `numero_echeance`, `montant_cents`, `date_prevue`, `statut`, `payment_id`

**`payment_events`** — **garantit l'idempotence**
`id`, `provider`, `provider_event_id` (**UNIQUE**), `type`, `payload` (jsonb), `traite_at`, `erreur`

La contrainte d'unicité sur `provider_event_id` est ce qui empêche un webhook rejoué de créer
deux inscriptions. Le handler insère d'abord ici ; si l'insertion échoue sur la contrainte,
l'événement a déjà été traité et on s'arrête.

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

## Traçabilité

**`automation_logs`** — `id`, `declencheur`, `entite_type`, `entite_id`, `statut`, `details` (jsonb), `created_at`

**`audit_logs`** — `id`, `user_id`, `action`, `table_cible`, `enregistrement_id`, `avant` (jsonb),
`apres` (jsonb), `ip`, `created_at`

**`consents`** — `id`, `user_id` ou `email`, `type`, `accorde`, `version_texte`, `ip`, `created_at`

## RLS — les trois politiques qui comptent

RLS activée sur toutes les tables sans exception. Une table sans politique est inaccessible :
c'est le bon défaut.

```sql
create or replace function public.has_role(r text)
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.user_roles
                 where user_id = auth.uid() and role = r);
$$;

-- Un coach n'accède qu'à ses cohortes
create or replace function public.coach_de_cohorte(c uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.cohorte_coachs
                 where cohorte_id = c and coach_id = auth.uid());
$$;
```

**Politique 1 — le client voit ses données.**
`using (user_id = auth.uid())`

**Politique 2 — le coach voit sa cohorte, et rien d'autre.**

```sql
create policy coach_lit_inscriptions on inscriptions for select
using (coach_de_cohorte(cohorte_id) or has_role('admin') or has_role('owner'));
```

Notez l'absence de `client` : un client ne lit pas les inscriptions des autres, il passe par
la politique 1.

**Politique 3 — les données financières sont fermées aux coachs.**
Sur `orders`, `payments`, `refunds`, `disputes` : `using (has_role('admin') or has_role('owner'))`,
plus une politique séparée permettant au client de lire ses propres factures.

**Indexez les colonnes utilisées dans les politiques** — `cohorte_coachs.coach_id`,
`inscriptions.cohorte_id`, `inscriptions.user_id`. Une politique s'évalue ligne à ligne ; sans
index, les performances s'effondrent dès quelques milliers de lignes.

**Testez chaque politique avec un jeu de données de chaque rôle.** Une politique jamais testée
est une politique fausse. Prévoyez `supabase/seed.sql` avec un utilisateur de chaque rôle et
deux cohortes distinctes, précisément pour vérifier qu'un coach ne voit pas la cohorte de l'autre.
