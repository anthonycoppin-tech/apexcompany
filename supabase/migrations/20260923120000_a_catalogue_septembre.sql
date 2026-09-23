-- Le catalogue réel, livré par le client le 23 septembre 2026.
--
-- Jusqu'ici la base portait les produits de la révision 2 — « Accélérateur »
-- enregistré comme une formation en groupe alors que c'est un accompagnement
-- individuel, aucun abonnement — et le site affichait donc des données fausses.
-- C'était noté comme bloqué depuis le 8 septembre, faute de connaître les vrais
-- produits (`docs/08-CE-QUI-MANQUE.md`).
--
-- **Les huit produits ci-dessous sont insérés en brouillon**, et il faut que ce
-- soit dit : ce n'est pas une précaution timide, c'est la règle du 13 septembre.
-- Un produit publié doit déclarer son `discord_role_id`, sinon il encaisse un
-- paiement sans ouvrir d'accès. Les rôles n'existent pas encore sur le serveur ;
-- ils sont réclamés au client dans `08-CE-QUI-MANQUE.md`. On les saisit dans
-- `/admin/formations`, on coche « publié », et le produit part en vente.
--
-- `on conflict (slug) do nothing` : cette migration est rejouable, et surtout
-- **elle n'écrase jamais ce que le client a modifié**. Un prix ajusté depuis le
-- back-office ne doit pas revenir à sa valeur d'origine parce qu'on a rejoué
-- les migrations sur un nouvel environnement.
--
-- ── Ce qui N'EST PAS ici, et pourquoi ────────────────────────────────────────
--
-- Le document du client compte seize liens de paiement ; huit produits seulement
-- rentrent dans le modèle. Les autres demandent chacun une migration de schéma,
-- pas une ligne de catalogue :
--
-- - **les variantes « en 2 fois »** (PALACE 2, PALACE 3, APEX BLACK) —
--   l'échelonnement a été supprimé le 8 septembre (`payment_schedules`,
--   `orders.echelonne`). Et au-delà des tables, `traiter_paiement()` ouvre
--   l'accès complet dès le premier encaissement : il n'a aucune notion de solde
--   restant dû. Vendre un 2× aujourd'hui, c'est offrir le produit à la première
--   échéance ;
-- - **l'acompte de réservation de 150 €** — rien n'existe : ni avoir, ni lien
--   entre deux commandes. Encaissé tel quel, il produirait une inscription
--   active, un rôle Discord et une facture définitive pour un acompte ;
-- - **APEX MASTERY**, le séminaire de Toulouse des 23 et 24 octobre 2026, en
--   trois formules — aucune table d'événements, aucune date, aucune jauge, et
--   `renonceALAcces()` ferait renoncer l'acheteur à sa rétractation, ce qui
--   n'est pas le régime d'une prestation datée. **C'est le plus urgent des
--   quatre : il a lieu dans un mois** ;
-- - **APEX PRIME annuel** — `+ 30` est écrit en dur dans `traiter_paiement()` et
--   dans `renouveler_abonnement()`, sans branche conditionnelle, et
--   `subscriptions` n'a aucune colonne de périodicité.
--
-- Ces quatre-là continuent de se vendre par leur lien Whop. Leurs encaissements
-- arrivent sans métadonnées et tombent dans la file de rattrapage du
-- back-office, où l'on sait au moins quel plan a été acheté.

insert into public.formations (
  slug, titre, description, prix_cents, type_produit, modalite,
  duree_acces_jours, whop_plan_id, actif, ordre
) values
  (
    'apex-prime', 'APEX PRIME',
    'Abonnement mensuel : accès à la communauté et au suivi continu.',
    5900, 'abonnement', 'groupe', null, 'plan_GNQsx2jJiZsOT', false, 1
  ),
  (
    'palace-1', 'PALACE 1',
    'Un mois d''accompagnement sur compte 10K, avec les lives et les calls groupés.',
    29000, 'accompagnement', 'groupe', 30, 'plan_HNCR6QI560QM1', false, 2
  ),
  (
    'palace-2', 'PALACE 2',
    'Deux mois d''accompagnement sur compte 50K, avec un entretien individuel de trente minutes.',
    89000, 'accompagnement', 'individuel', 60, 'plan_bvYvfpyqqBjeg', false, 3
  ),
  (
    'palace-3', 'PALACE 3',
    'Trois mois d''accompagnement sur compte 100K, avec deux entretiens individuels.',
    160000, 'accompagnement', 'individuel', 90, 'plan_StjC1chIDcioB', false, 4
  ),
  (
    'matrix-3', 'MATRIX 3.0',
    'Six mois : calls groupés et coaching individuel.',
    450000, 'accompagnement', 'individuel', 180, 'plan_G0PymC7FAYrF6', false, 5
  ),
  (
    'apex-black', 'APEX BLACK',
    'Accompagnement haut de gamme, acheté une fois, accès sans limite de durée.',
    480000, 'formation', 'individuel', null, 'plan_fbFAmHpHa08DV', false, 6
  ),
  (
    'apex-partner', 'APEX PARTNER',
    'Certification de coach, achetée une fois, accès sans limite de durée.',
    550000, 'formation', 'individuel', null, 'plan_ccyYwWyNlsG00', false, 7
  ),
  (
    'apex-partner-lancement', 'APEX PARTNER — 6 mois lancement',
    'Six mois en présentiel et en calls groupés. Sur sélection.',
    450000, 'accompagnement', 'groupe', 180, 'plan_qlCjPtenv4Fyn', false, 8
  )
on conflict (slug) do nothing;
