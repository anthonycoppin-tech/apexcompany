-- ═══════════════════════════════════════════════════════════════════════════
-- Jeu de données de développement
--
-- Un utilisateur par rôle, et DEUX cohortes encadrées par DEUX coachs
-- différents. Cette deuxième cohorte nest pas décorative : cest elle qui
-- permet de vérifier quun coach ne voit pas les clients de lautre. Un jeu de
-- données à une seule cohorte laisse passer exactement le bug quon cherche.
--
-- Mots de passe : « password123 » pour tous les comptes.
-- ═══════════════════════════════════════════════════════════════════════════

-- Identifiants figés : les tests sy réfèrent directement.
--   owner    11111111-1111-1111-1111-111111111111
--   admin    22222222-2222-2222-2222-222222222222
--   coach A  33333333-3333-3333-3333-333333333333
--   coach B  44444444-4444-4444-4444-444444444444
--   branding 55555555-5555-5555-5555-555555555555
--   client A 66666666-6666-6666-6666-666666666666
--   client B 77777777-7777-7777-7777-777777777777

create or replace function pg_temp.creer_utilisateur(
  p_id uuid,
  p_email text,
  p_prenom text,
  p_nom text
) returns uuid
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
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
    now()
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

select pg_temp.creer_utilisateur('11111111-1111-1111-1111-111111111111', 'owner@apex.test',    'Olivia', 'Owner');
select pg_temp.creer_utilisateur('22222222-2222-2222-2222-222222222222', 'admin@apex.test',    'Adam',   'Admin');
select pg_temp.creer_utilisateur('33333333-3333-3333-3333-333333333333', 'coach.a@apex.test',  'Camille', 'CoachA');
select pg_temp.creer_utilisateur('44444444-4444-4444-4444-444444444444', 'coach.b@apex.test',  'Bruno',  'CoachB');
select pg_temp.creer_utilisateur('55555555-5555-5555-5555-555555555555', 'branding@apex.test', 'Bella',  'Branding');
select pg_temp.creer_utilisateur('66666666-6666-6666-6666-666666666666', 'client.a@apex.test', 'Chloe',  'ClientA');
select pg_temp.creer_utilisateur('77777777-7777-7777-7777-777777777777', 'client.b@apex.test', 'Camil',  'ClientB');

-- Le trigger handle_new_user a déjà attribué « client » à tout le monde.
-- On ajoute les rôles internes, et on retire « client » à ceux qui ne le sont pas.
insert into public.user_roles (user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'admin'),
  ('33333333-3333-3333-3333-333333333333', 'coach'),
  ('44444444-4444-4444-4444-444444444444', 'coach'),
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

insert into public.offres (
  id, slug, titre, description, prix_cents, duree_semaines, volume_horaire,
  paiement_echelonne_possible, nb_echeances_max, actif, ordre
) values
  (
    'a0000000-0000-0000-0000-000000000001',
    'accelerateur',
    'Accélérateur',
    'Programme intensif de 12 semaines, sessions live hebdomadaires.',
    249000, 12, 48, true, 3, true, 1
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'fondations',
    'Fondations',
    'Parcours découverte de 6 semaines.',
    99000, 6, 18, true, 2, true, 2
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'mentorat-prive',
    'Mentorat privé',
    'Accompagnement individuel. Brouillon, non publié.',
    590000, 24, 24, false, 1, false, 3
  );

-- Deux cohortes, deux coachs ───────────────────────────────────────────────

insert into public.cohortes (id, offre_id, nom, date_debut, date_fin, places_max, statut, discord_role_id) values
  (
    'c0000000-0000-0000-0000-00000000000a',
    'a0000000-0000-0000-0000-000000000001',
    'Accélérateur — Promo A',
    current_date - 14, current_date + 70, 15, 'en_cours', '900000000000000001'
  ),
  (
    'c0000000-0000-0000-0000-00000000000b',
    'a0000000-0000-0000-0000-000000000001',
    'Accélérateur — Promo B',
    current_date - 7, current_date + 77, 15, 'en_cours', '900000000000000002'
  );

insert into public.cohorte_coachs (cohorte_id, coach_id) values
  ('c0000000-0000-0000-0000-00000000000a', '33333333-3333-3333-3333-333333333333'),
  ('c0000000-0000-0000-0000-00000000000b', '44444444-4444-4444-4444-444444444444');

-- Commandes et inscriptions ────────────────────────────────────────────────

insert into public.orders (id, user_id, offre_id, cohorte_id, montant_cents, statut, provider, provider_order_id, echelonne) values
  (
    'd0000000-0000-0000-0000-00000000000a',
    '66666666-6666-6666-6666-666666666666',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-00000000000a',
    249000, 'payee', 'stripe', 'cs_test_seed_a', false
  ),
  (
    'd0000000-0000-0000-0000-00000000000b',
    '77777777-7777-7777-7777-777777777777',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-00000000000b',
    249000, 'partielle', 'stripe', 'cs_test_seed_b', true
  );

insert into public.payments (order_id, montant_cents, statut, provider, provider_payment_id, methode, paid_at) values
  ('d0000000-0000-0000-0000-00000000000a', 249000, 'reussi', 'stripe', 'pi_test_seed_a', 'card', now() - interval '14 days'),
  ('d0000000-0000-0000-0000-00000000000b', 83000,  'reussi', 'stripe', 'pi_test_seed_b', 'card', now() - interval '7 days');

insert into public.payment_schedules (order_id, numero_echeance, montant_cents, date_prevue, statut) values
  ('d0000000-0000-0000-0000-00000000000b', 1, 83000, current_date - 7,  'payee'),
  ('d0000000-0000-0000-0000-00000000000b', 2, 83000, current_date + 23, 'a_venir'),
  ('d0000000-0000-0000-0000-00000000000b', 3, 83000, current_date + 53, 'a_venir');

insert into public.invoices (order_id) values ('d0000000-0000-0000-0000-00000000000a');

insert into public.inscriptions (id, user_id, offre_id, cohorte_id, statut, order_id) values
  (
    'e0000000-0000-0000-0000-00000000000a',
    '66666666-6666-6666-6666-666666666666',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-00000000000a',
    'active',
    'd0000000-0000-0000-0000-00000000000a'
  ),
  (
    'e0000000-0000-0000-0000-00000000000b',
    '77777777-7777-7777-7777-777777777777',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-00000000000b',
    'active',
    'd0000000-0000-0000-0000-00000000000b'
  );

-- Sessions, replays, suivi ─────────────────────────────────────────────────

insert into public.sessions (id, cohorte_id, titre, type, debut, fin, coach_id, statut) values
  (
    'f0000000-0000-0000-0000-00000000000a',
    'c0000000-0000-0000-0000-00000000000a',
    'Session 1 — Cadrage',
    'live',
    now() - interval '7 days', now() - interval '7 days' + interval '2 hours',
    '33333333-3333-3333-3333-333333333333',
    'terminee'
  ),
  (
    'f0000000-0000-0000-0000-00000000000b',
    'c0000000-0000-0000-0000-00000000000b',
    'Session 1 — Cadrage',
    'live',
    now() - interval '3 days', now() - interval '3 days' + interval '2 hours',
    '44444444-4444-4444-4444-444444444444',
    'terminee'
  ),
  (
    'f0000000-0000-0000-0000-00000000000c',
    'c0000000-0000-0000-0000-00000000000a',
    'Session 2 — Mise en pratique',
    'live',
    now() + interval '2 days', now() + interval '2 days' + interval '2 hours',
    '33333333-3333-3333-3333-333333333333',
    'planifiee'
  );

insert into public.presences (session_id, inscription_id, present, duree_minutes, saisi_par) values
  ('f0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000a', true, 118, '33333333-3333-3333-3333-333333333333'),
  ('f0000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-00000000000b', true, 95,  '44444444-4444-4444-4444-444444444444');

insert into public.replays (session_id, provider, provider_asset_id, duree_secondes, publie, uploaded_by) values
  ('f0000000-0000-0000-0000-00000000000a', 'cloudflare', 'seed-asset-cohorte-a', 7080, true,  '33333333-3333-3333-3333-333333333333'),
  ('f0000000-0000-0000-0000-00000000000b', 'cloudflare', 'seed-asset-cohorte-b', 5700, true,  '44444444-4444-4444-4444-444444444444'),
  ('f0000000-0000-0000-0000-00000000000c', 'cloudflare', 'seed-asset-non-publie', 0,   false, '33333333-3333-3333-3333-333333333333');

-- Une note visible et une note interne sur le MÊME client : cest le couple qui
-- permet de vérifier que le cloisonnement de visible_client tient.
insert into public.suivi_notes (inscription_id, coach_id, type, contenu, visible_client) values
  (
    'e0000000-0000-0000-0000-00000000000a',
    '33333333-3333-3333-3333-333333333333',
    'objectif',
    'Objectif du trimestre : structurer offre et publier trois études de cas.',
    true
  ),
  (
    'e0000000-0000-0000-0000-00000000000a',
    '33333333-3333-3333-3333-333333333333',
    'observation',
    'NOTE INTERNE — assiduité irrégulière, à surveiller avant de proposer un renouvellement.',
    false
  );

-- Pipeline commercial ──────────────────────────────────────────────────────

insert into public.leads (email, prenom, nom, source, statut, offre_recommandee_id, assigned_to) values
  ('prospect1@example.com', 'Paul',  'Prospect', 'instagram', 'nouveau',     'a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('prospect2@example.com', 'Prune', 'Prospect', 'youtube',   'rdv',         'a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('prospect3@example.com', 'Pierre','Prospect', 'tiktok',    'proposition', 'a0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222'),
  ('prospect4@example.com', 'Perle', 'Prospect', 'instagram', 'gagne',       'a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('prospect5@example.com', 'Pablo', 'Prospect', 'direct',    'perdu',       null,                                   '22222222-2222-2222-2222-222222222222');

-- Liaisons Discord ─────────────────────────────────────────────────────────

insert into public.discord_links (user_id, discord_user_id, discord_username, roles_attribues, derniere_sync) values
  ('66666666-6666-6666-6666-666666666666', '100000000000000001', 'chloe_a', '["900000000000000001"]'::jsonb, now()),
  ('77777777-7777-7777-7777-777777777777', '100000000000000002', 'camil_b', '["900000000000000002"]'::jsonb, now());
