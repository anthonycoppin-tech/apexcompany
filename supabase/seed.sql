-- ═══════════════════════════════════════════════════════════════════════════
-- Jeu de données de développement — révision 3
--
-- Un utilisateur par rôle, et DEUX formateurs avec des clients, des prospects
-- et des propositions DISTINCTS. Ce deuxième formateur n'est pas décoratif :
-- c'est lui qui permet de vérifier qu'un formateur ne voit pas les clients de
-- l'autre. Un jeu de données à un seul formateur laisse passer exactement le
-- bug qu'on cherche. C'est l'équivalent, sans cohortes, du jeu à deux promotions
-- de la révision 2.
--
-- Le seed est une INTERFACE, pas un jeu de confort : le développeur B construit
-- ses écrans dessus. Y ajouter un cas débloque un écran chez l'autre.
--
-- Les trois types de produit sont représentés, parce que c'est l'invariant
-- central de la révision 3 : trois modèles économiques, une seule mécanique
-- d'accès (`inscriptions.date_fin_acces`, `null` = illimité).
--
-- Mots de passe : « password123 » pour tous les comptes.
-- ═══════════════════════════════════════════════════════════════════════════

-- Identifiants figés : les tests s'y réfèrent directement.
--   owner       11111111-1111-1111-1111-111111111111
--   admin       22222222-2222-2222-2222-222222222222
--   formateur A 33333333-3333-3333-3333-333333333333
--   formateur B 44444444-4444-4444-4444-444444444444
--   branding    55555555-5555-5555-5555-555555555555
--   client A    66666666-6666-6666-6666-666666666666
--   client B    77777777-7777-7777-7777-777777777777

create or replace function pg_temp.creer_utilisateur(
  p_id uuid,
  p_email text,
  p_prenom text,
  p_nom text
) returns uuid
language plpgsql
as $$
begin
  -- Les colonnes de jetons (confirmation_token, recovery_token, ...) doivent
  -- être des chaînes vides, jamais NULL : GoTrue les scanne dans des champs Go
  -- non nullables et répond « Database error querying schema » (500) à la
  -- connexion si l une d elles est NULL. Cassé une fois en silence sur le
  -- projet hébergé — ni pgTAP ni PGlite ne l auraient vu, aucun des deux ne
  -- fait un vrai /auth/v1/token.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('prenom', p_prenom, 'nom', p_nom),
    now(),
    now(),
    '', '', '', '', '', '', '', ''
  );

  -- Sans identité associée, la connexion par mot de passe échoue sur les
  -- versions récentes de GoTrue.
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at,
    created_at, updated_at
  ) values (
    gen_random_uuid(),
    p_id,
    p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email',
    now(),
    now(),
    now()
  );

  return p_id;
end;
$$;

select pg_temp.creer_utilisateur('11111111-1111-1111-1111-111111111111', 'owner@apex.test',        'Olivia',  'Owner');
select pg_temp.creer_utilisateur('22222222-2222-2222-2222-222222222222', 'admin@apex.test',        'Adam',    'Admin');
select pg_temp.creer_utilisateur('33333333-3333-3333-3333-333333333333', 'formateur.a@apex.test',  'Camille', 'FormateurA');
select pg_temp.creer_utilisateur('44444444-4444-4444-4444-444444444444', 'formateur.b@apex.test',  'Bruno',   'FormateurB');
select pg_temp.creer_utilisateur('55555555-5555-5555-5555-555555555555', 'branding@apex.test',     'Bella',   'Branding');
select pg_temp.creer_utilisateur('66666666-6666-6666-6666-666666666666', 'client.a@apex.test',     'Chloe',   'ClientA');
select pg_temp.creer_utilisateur('77777777-7777-7777-7777-777777777777', 'client.b@apex.test',     'Camil',   'ClientB');

-- Le trigger handle_new_user a déjà attribué « client » à tout le monde.
-- On ajoute les rôles internes, et on retire « client » à ceux qui ne le sont pas.
insert into public.user_roles (user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'formateur'),
  ('44444444-4444-4444-4444-444444444444', 'formateur'),
  ('55555555-5555-5555-5555-555555555555', 'branding');

delete from public.user_roles
where role = 'client'
  and user_id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555'
  );

-- Catalogue ────────────────────────────────────────────────────────────────
-- Les trois types de produit, plus un brouillon. Le brouillon existe pour
-- qu'un test puisse vérifier qu'un visiteur anonyme ne le voit pas.

insert into public.formations (
  id, slug, titre, description, prix_cents, type_produit, modalite,
  duree_acces_jours, discord_role_id, duree_semaines, volume_horaire, actif, ordre
) values
  (
    'a0000000-0000-0000-0000-000000000001',
    'communaute',
    'Communauté',
    'Abonnement mensuel : salon privé, planning hebdomadaire, contenu exclusif.',
    4900, 'abonnement', 'groupe',
    null, '900000000000000001', null, null, true, 1
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'accelerateur',
    'Accélérateur',
    'Accompagnement individuel de 3 mois, séances organisées avec le formateur.',
    249000, 'accompagnement', 'individuel',
    90, '900000000000000002', 12, 48, true, 2
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'fondations',
    'Fondations',
    'Formation en groupe, achetée une fois, accès illimité.',
    99000, 'formation', 'groupe',
    null, '900000000000000003', 6, 18, true, 3
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'mentorat-prive',
    'Mentorat privé',
    'Accompagnement individuel de 6 mois. Brouillon, non publié.',
    590000, 'accompagnement', 'individuel',
    180, null, 24, 24, false, 4
  );

-- Pipeline commercial ──────────────────────────────────────────────────────
-- Cinq prospects, répartis entre les deux formateurs. C'est cette répartition
-- qui rend testable « un formateur ne voit pas les prospects de l'autre ».
-- Deux d'entre eux ont un compte : le tunnel inversé crée le compte au
-- formulaire, donc un lead converti garde sa fiche.

insert into public.leads (
  id, email, prenom, nom, telephone, source, statut, user_id,
  zone_geo, tranche_age, situation_pro, niveau_trading, prop_firm,
  blocage, tranche_budget, delai_objectif, eligible,
  produit_souhaite_id, produit_recommande_id, assigned_to
) values
  (
    'b0000000-0000-0000-0000-000000000001',
    'prospect1@example.com', 'Paul', null, '+33600000001', 'instagram', 'nouveau', null,
    'europe', '25_35', 'salarie', 'debutant', 'non',
    'discipline', '1000_2000', 'mois_prochain', true,
    'a0000000-0000-0000-0000-000000000003', null,
    '33333333-3333-3333-3333-333333333333'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'client.a@apex.test', 'Chloe', 'ClientA', '+33600000002', 'youtube', 'gagne',
    '66666666-6666-6666-6666-666666666666',
    'europe', '35_50', 'independant', 'intermediaire', 'en_challenge',
    'gestion_risque', '2000_5000', 'immediat', true,
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000002',
    '33333333-3333-3333-3333-333333333333'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'prospect3@example.com', 'Pierre', null, '+33600000003', 'tiktok', 'proposition', null,
    'amerique', '18_25', 'etudiant', 'decouverte', 'non',
    'strategie', '500_1000', 'trois_mois', true,
    'a0000000-0000-0000-0000-000000000001', null,
    '44444444-4444-4444-4444-444444444444'
  ),
  (
    'b0000000-0000-0000-0000-000000000004',
    'client.b@apex.test', 'Camil', 'ClientB', '+33600000004', 'instagram', 'gagne',
    '77777777-7777-7777-7777-777777777777',
    'europe', '25_35', 'sans_emploi', 'debutant', 'non',
    'prop_firm', '500_1000', 'immediat', true,
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '44444444-4444-4444-4444-444444444444'
  ),
  (
    'b0000000-0000-0000-0000-000000000005',
    'prospect5@example.com', 'Pablo', null, '+33600000005', 'direct', 'perdu', null,
    'afrique', 'plus_50', 'salarie', 'avance', 'oui',
    'strategie', 'plus_5000', 'trois_mois', false,
    null, null,
    '22222222-2222-2222-2222-222222222222'
  );

-- La soumission complète du formulaire vit ici, en jsonb. Les colonnes de
-- `leads` n'en sont qu'une projection destinée au tri et au filtrage :
-- l'original reste lisible même si les questions changent.
insert into public.lead_events (lead_id, type, payload) values
  (
    'b0000000-0000-0000-0000-000000000001',
    'formulaire_soumis',
    '{"prenom":"Paul","zone_geo":"europe","tranche_age":"25_35","situation_pro":"salarie","niveau_trading":"debutant","prop_firm":"non","blocage":"discipline","tranche_budget":"1000_2000","delai_objectif":"mois_prochain"}'::jsonb
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'formulaire_soumis',
    '{"prenom":"Chloe","zone_geo":"europe","tranche_age":"35_50","situation_pro":"independant","niveau_trading":"intermediaire","prop_firm":"en_challenge","blocage":"gestion_risque","tranche_budget":"2000_5000","delai_objectif":"immediat"}'::jsonb
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'formulaire_soumis',
    '{"prenom":"Pierre","zone_geo":"amerique","tranche_age":"18_25","situation_pro":"etudiant","niveau_trading":"decouverte","prop_firm":"non","blocage":"strategie","tranche_budget":"500_1000","delai_objectif":"trois_mois"}'::jsonb
  );

-- Les audits de vente. Un honoré avec compte rendu, un encore à venir : c'est
-- le couple qui rend la statistique de no-show calculable.
insert into public.appointments (
  lead_id, cal_booking_id, debut, fin, statut, conseiller_id, issue, compte_rendu
) values
  (
    'b0000000-0000-0000-0000-000000000002',
    'cal_seed_a', now() - interval '10 days', now() - interval '10 days' + interval '45 minutes',
    'confirme', '33333333-3333-3333-3333-333333333333',
    'honore', 'Profil sérieux, gestion du risque à reprendre. Accélérateur proposé.'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'cal_seed_b', now() + interval '2 days', now() + interval '2 days' + interval '45 minutes',
    'planifie', '44444444-4444-4444-4444-444444444444',
    null, null
  );

-- Commandes, encaissements, factures ───────────────────────────────────────

insert into public.orders (
  id, user_id, lead_id, formation_id, montant_cents, statut, provider, provider_order_id
) values
  (
    'd0000000-0000-0000-0000-00000000000a',
    '66666666-6666-6666-6666-666666666666',
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    249000, 'payee', 'stripe', 'cs_test_seed_a'
  ),
  (
    'd0000000-0000-0000-0000-00000000000b',
    '77777777-7777-7777-7777-777777777777',
    'b0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    4900, 'payee', 'stripe', 'cs_test_seed_b'
  );

insert into public.payments (order_id, montant_cents, statut, provider, provider_payment_id, methode, paid_at) values
  ('d0000000-0000-0000-0000-00000000000a', 249000, 'reussi', 'stripe', 'pi_test_seed_a', 'card', now() - interval '9 days'),
  ('d0000000-0000-0000-0000-00000000000b', 4900,   'reussi', 'stripe', 'pi_test_seed_b', 'card', now() - interval '7 days');

insert into public.invoices (order_id) values ('d0000000-0000-0000-0000-00000000000a');

-- Inscriptions ─────────────────────────────────────────────────────────────
-- Deux types de produit, deux façons de calculer date_fin_acces, une seule
-- mécanique : l'accompagnement compte ses 90 jours depuis l'achat, l'abonnement
-- s'arrête à la fin de la période payée et sera repoussé au prélèvement suivant.

insert into public.inscriptions (
  id, user_id, formation_id, formateur_id, statut, date_debut, date_fin_acces, order_id
) values
  (
    'e0000000-0000-0000-0000-00000000000a',
    '66666666-6666-6666-6666-666666666666',
    'a0000000-0000-0000-0000-000000000002',
    '33333333-3333-3333-3333-333333333333',
    'active', current_date - 9, current_date + 81,
    'd0000000-0000-0000-0000-00000000000a'
  ),
  (
    'e0000000-0000-0000-0000-00000000000b',
    '77777777-7777-7777-7777-777777777777',
    'a0000000-0000-0000-0000-000000000001',
    '44444444-4444-4444-4444-444444444444',
    'active', current_date - 7, current_date + 23,
    'd0000000-0000-0000-0000-00000000000b'
  );

insert into public.subscriptions (
  user_id, formation_id, inscription_id, provider, provider_subscription_id, statut, periode_fin
) values
  (
    '77777777-7777-7777-7777-777777777777',
    'a0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-00000000000b',
    'stripe', 'sub_test_seed_b', 'active',
    now() + interval '23 days'
  );

-- Propositions ─────────────────────────────────────────────────────────────
-- Une par formateur, pour que le cloisonnement soit testable ici aussi.

insert into public.propositions (
  id, lead_id, user_id, formation_id, formateur_id, montant_cents, statut, expire_le, order_id
) values
  (
    'f0000000-0000-0000-0000-00000000000a',
    'b0000000-0000-0000-0000-000000000002',
    '66666666-6666-6666-6666-666666666666',
    'a0000000-0000-0000-0000-000000000002',
    '33333333-3333-3333-3333-333333333333',
    249000, 'acceptee', now() - interval '3 days',
    'd0000000-0000-0000-0000-00000000000a'
  ),
  (
    'f0000000-0000-0000-0000-00000000000b',
    'b0000000-0000-0000-0000-000000000003',
    '77777777-7777-7777-7777-777777777777',
    'a0000000-0000-0000-0000-000000000001',
    '44444444-4444-4444-4444-444444444444',
    4900, 'envoyee', now() + interval '5 days',
    null
  );

-- Suivi individuel ─────────────────────────────────────────────────────────
-- Une note visible et une note interne sur le MÊME client : c'est le couple qui
-- permet de vérifier que le cloisonnement de visible_client tient. La note du
-- formateur B est là pour vérifier que le formateur A ne la voit pas.

insert into public.suivi_notes (inscription_id, formateur_id, type, contenu, visible_client) values
  (
    'e0000000-0000-0000-0000-00000000000a',
    '33333333-3333-3333-3333-333333333333',
    'objectif',
    'Objectif du trimestre : tenir le plan de risque sur vingt trades consécutifs.',
    true
  ),
  (
    'e0000000-0000-0000-0000-00000000000a',
    '33333333-3333-3333-3333-333333333333',
    'observation',
    'NOTE INTERNE — revient sur ses pertes, à ne pas pousser vers un produit plus cher.',
    false
  ),
  (
    'e0000000-0000-0000-0000-00000000000b',
    '44444444-4444-4444-4444-444444444444',
    'observation',
    'NOTE INTERNE du formateur B — ne doit jamais apparaître chez le formateur A.',
    false
  );

-- Liaisons Discord ─────────────────────────────────────────────────────────
-- Le rôle attribué correspond à celui de la formation achetée, pas à une
-- cohorte : la révocation se raisonne par inscription, jamais par personne.

insert into public.discord_links (user_id, discord_user_id, discord_username, roles_attribues, derniere_sync) values
  ('66666666-6666-6666-6666-666666666666', '100000000000000001', 'chloe_a', '["900000000000000002"]'::jsonb, now()),
  ('77777777-7777-7777-7777-777777777777', '100000000000000002', 'camil_b', '["900000000000000001"]'::jsonb, now());

insert into public.consents (user_id, type, accorde, version_texte, ip) values
  ('66666666-6666-6666-6666-666666666666', 'confidentialite', true, '2026-09-v1', '203.0.113.10'),
  ('77777777-7777-7777-7777-777777777777', 'confidentialite', true, '2026-09-v1', '203.0.113.11');
