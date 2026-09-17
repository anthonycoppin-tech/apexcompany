-- ═══════════════════════════════════════════════════════════════════════════
-- L'effacement d'une personne, à sa demande
--
-- Comme la purge, elle supprime des comptes : le seul échec qui compte est
-- d'effacer ce qu'il fallait garder — une trace d'achat, un compte de
-- l'équipe — ou de laisser quelqu'un d'autre que le staff l'appeler.
--
-- scripts/verifier-schema.mjs lit le jeu d'essai DANS CE FICHIER, entre
-- « Jeu d'essai » et « Les vérifications ». Renommer l'un ou l'autre casse
-- `db:check`.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
select plan(14);

-- ── Jeu d'essai ────────────────────────────────────────────────────────────

-- d1 — un compte sans achat, qui demande l'effacement.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000', '0d000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'efface.moi@example.com', '',
  '{}'::jsonb, '{}'::jsonb, now(), now(),
  '', '', '', '', '', '', '', ''
);

insert into public.leads (id, email, statut, user_id) values
  -- c1 — son lead.
  ('0c000000-0000-0000-0000-000000000001', 'efface.moi@example.com', 'rdv',
   '0d000000-0000-0000-0000-000000000001'),
  -- c2 — un ancien lead sans compte, même adresse : part avec lui.
  ('0c000000-0000-0000-0000-000000000002', 'Efface.Moi@example.com', 'perdu', null),
  -- c3 — un lead rattaché à un compte formateur : jamais d'ici.
  ('0c000000-0000-0000-0000-000000000003', 'formateur.a@apex.test', 'perdu',
   '33333333-3333-3333-3333-333333333333'),
  -- c4 — un lead sans compte, mais avec une commande, même annulée.
  ('0c000000-0000-0000-0000-000000000004', 'commande.annulee@example.com', 'perdu', null);

insert into public.lead_events (lead_id, type, payload)
values ('0c000000-0000-0000-0000-000000000001', 'formulaire_soumis', '{}'::jsonb);

insert into public.appointments (lead_id, cal_booking_id, debut, fin)
values ('0c000000-0000-0000-0000-000000000001', 'cal_efface',
        now() + interval '1 day', now() + interval '1 day' + interval '45 minutes');

insert into public.consents (user_id, email, type, accorde, version_texte) values
  ('0d000000-0000-0000-0000-000000000001', null, 'confidentialite', true, '2026-09-v1'),
  (null, 'efface.moi@example.com', 'confidentialite', true, '2026-09-v1');

insert into public.orders (lead_id, formation_id, montant_cents, statut, provider, provider_order_id)
values ('0c000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
        0, 'annulee', 'stripe', 'cs_effacement_c4');

-- ── Les vérifications ──────────────────────────────────────────────────────

set local role authenticated;

-- Un client ne peut pas l'appeler, pas même sur son propre prospect.
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';

select throws_ok(
  $$select public.effacer_personne('b0000000-0000-0000-0000-000000000002', true)$$,
  '42501',
  null,
  'un client ne peut pas lancer un effacement'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  $$select public.effacer_personne('0c000000-0000-0000-0000-0000000000ff', true)$$,
  'P0002',
  null,
  'un prospect inconnu est signalé, pas ignoré'
);

select is(
  (public.effacer_personne('0c000000-0000-0000-0000-000000000001') ->> 'possible')::boolean,
  true,
  'une personne sans achat peut être effacée'
);

select is(
  public.effacer_personne('0c000000-0000-0000-0000-000000000001') - 'possible' - 'simulation',
  '{"compte": true, "leads": 2, "rendez_vous": 1, "consentements": 2}'::jsonb,
  'la simulation annonce le compte, ses deux leads, son rendez-vous et ses deux consentements'
);

select is(
  (select count(*) from public.leads where id = '0c000000-0000-0000-0000-000000000001')::int, 1,
  'la simulation ne supprime rien'
);

select is(
  (public.effacer_personne('b0000000-0000-0000-0000-000000000002') ->> 'possible')::boolean,
  false,
  'un client ne s''efface pas d''ici : ses pièces comptables se conservent'
);

select is(
  (public.effacer_personne('0c000000-0000-0000-0000-000000000003') ->> 'possible')::boolean,
  false,
  'un compte de l''équipe ne s''efface pas d''ici'
);

select is(
  (public.effacer_personne('0c000000-0000-0000-0000-000000000004') ->> 'possible')::boolean,
  false,
  'une commande, même annulée, bloque l''effacement'
);

select is(
  (public.effacer_personne('0c000000-0000-0000-0000-000000000001', false) ->> 'leads')::int,
  2,
  'l''effacement réel supprime ce qui était annoncé'
);

reset role;

select is(
  (select count(*) from auth.users where id = '0d000000-0000-0000-0000-000000000001')::int, 0,
  'le compte a disparu'
);

select is(
  (select count(*) from public.leads
   where id in ('0c000000-0000-0000-0000-000000000001', '0c000000-0000-0000-0000-000000000002'))::int,
  0,
  'ses leads, y compris l''ancien sans compte, ont disparu'
);

select is(
  (select count(*) from public.appointments where cal_booking_id = 'cal_efface')::int
    + (select count(*) from public.consents
       where user_id = '0d000000-0000-0000-0000-000000000001'
          or lower(email) = 'efface.moi@example.com')::int,
  0,
  'son rendez-vous et ses consentements ont disparu'
);

select is(
  (select apres ->> 'motif' from public.audit_logs
   where action = 'EFFACEMENT' and enregistrement_id = '0d000000-0000-0000-0000-000000000001'),
  'demande de la personne',
  'l''effacement laisse une trace, sans l''adresse effacée'
);

select ok(
  not has_function_privilege('anon', 'public.effacer_personne(uuid, boolean)', 'execute'),
  'un visiteur anonyme ne peut pas l''appeler'
);

select * from finish();
rollback;
