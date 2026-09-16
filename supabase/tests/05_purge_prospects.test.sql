-- ═══════════════════════════════════════════════════════════════════════════
-- La purge des prospects inactifs
--
-- Elle supprime des comptes. Le seul échec qui compte est de supprimer
-- quelqu'un qu'il ne fallait pas : un client, un membre de l'équipe, une
-- personne revenue récemment. Le jeu d'essai est donc surtout fait de cas qui
-- doivent SURVIVRE, et un seul qui doit partir.
--
-- scripts/verifier-schema.mjs rejoue les mêmes vérifications sur PGlite, et
-- lit le jeu d'essai DANS CE FICHIER, entre la création de `pg_temp.vieux_compte`
-- et le titre de la section sur la simulation. Renommer l'un ou l'autre casse `db:check`.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
select plan(14);

create function pg_temp.vieux_compte(p_id uuid, p_email text, p_connexion timestamptz)
returns void
language plpgsql
as $$
begin
  -- Colonnes de jetons en chaîne vide, jamais NULL (CLAUDE.md).
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email, '', '{}'::jsonb, '{}'::jsonb,
    now() - interval '4 years', now() - interval '4 years', p_connexion,
    '', '', '', '', '', '', '', ''
  );
  update public.profiles set created_at = now() - interval '4 years' where id = p_id;
end;
$$;

-- e1 — le seul à partir : quatre ans sans signe de vie.
select pg_temp.vieux_compte('0e000000-0000-0000-0000-000000000001', 'vieux.prospect@example.com', null);
-- e2 — vieux compte, mais connecté le mois dernier.
select pg_temp.vieux_compte('0e000000-0000-0000-0000-000000000002', 'revenu@example.com', now() - interval '1 month');
-- e3 — vieux compte avec une commande, même annulée.
select pg_temp.vieux_compte('0e000000-0000-0000-0000-000000000003', 'commande@example.com', null);
-- e4 — vieux compte formateur.
select pg_temp.vieux_compte('0e000000-0000-0000-0000-000000000004', 'equipe@example.com', null);
-- e5 — vieux compte avec un rendez-vous la semaine prochaine.
select pg_temp.vieux_compte('0e000000-0000-0000-0000-000000000005', 'rdv@example.com', null);

insert into public.user_roles (user_id, role)
values ('0e000000-0000-0000-0000-000000000004', 'formateur');

insert into public.orders (user_id, formation_id, montant_cents, statut, provider, provider_order_id)
values ('0e000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
        0, 'annulee', 'stripe', 'cs_purge_e3');

insert into public.leads (id, email, statut, user_id, created_at) values
  ('0f000000-0000-0000-0000-000000000001', 'vieux.prospect@example.com', 'perdu',
   '0e000000-0000-0000-0000-000000000001', now() - interval '4 years'),
  ('0f000000-0000-0000-0000-000000000002', 'revenu@example.com', 'perdu',
   '0e000000-0000-0000-0000-000000000002', now() - interval '4 years'),
  ('0f000000-0000-0000-0000-000000000005', 'rdv@example.com', 'rdv',
   '0e000000-0000-0000-0000-000000000005', now() - interval '4 years'),
  -- l6 — sans compte, perdu : part.
  ('0f000000-0000-0000-0000-000000000006', 'ancien.lead@example.com', 'perdu',
   null, now() - interval '4 years'),
  -- l7 — sans compte, gagné : reste, c'est un client.
  ('0f000000-0000-0000-0000-000000000007', 'ancien.client@example.com', 'gagne',
   null, now() - interval '4 years'),
  -- l8 — sans compte, perdu, mais même adresse que le client A du seed.
  ('0f000000-0000-0000-0000-000000000008', 'client.a@apex.test', 'perdu',
   null, now() - interval '4 years');

insert into public.lead_events (lead_id, type, payload, created_at)
values ('0f000000-0000-0000-0000-000000000001', 'formulaire_soumis', '{}'::jsonb,
        now() - interval '4 years');

-- Une relance du formateur, récente : elle ne prolonge rien, le contact ne
-- vient pas du prospect.
insert into public.lead_events (lead_id, type, payload, created_at)
values ('0f000000-0000-0000-0000-000000000001', 'relance', '{}'::jsonb, now());

insert into public.appointments (lead_id, cal_booking_id, debut, fin, created_at) values
  ('0f000000-0000-0000-0000-000000000001', 'cal_purge_e1',
   now() - interval '4 years', now() - interval '4 years' + interval '45 minutes',
   now() - interval '4 years'),
  ('0f000000-0000-0000-0000-000000000005', 'cal_purge_e5',
   now() + interval '7 days', now() + interval '7 days' + interval '45 minutes',
   now() - interval '4 years');

insert into public.consents (user_id, email, type, accorde, version_texte, created_at) values
  ('0e000000-0000-0000-0000-000000000001', null, 'confidentialite', true, 'v1', now() - interval '4 years'),
  (null, 'ancien.lead@example.com', 'confidentialite', true, 'v1', now() - interval '4 years'),
  (null, 'client.a@apex.test', 'marketing', true, 'v1', now() - interval '4 years');

-- ── La simulation ne supprime rien ─────────────────────────────────────────

select is(
  public.purger_prospects_inactifs(true) - 'simulation',
  '{"comptes": 1, "leads": 3, "rendez_vous": 1, "consentements": 2}'::jsonb,
  'la simulation annonce exactement ce que la purge supprimera'
);

select is(
  (select count(*) from auth.users where id = '0e000000-0000-0000-0000-000000000001')::int, 1,
  'et ne supprime rien'
);

-- ── Le passage réel ────────────────────────────────────────────────────────

select is(
  public.purger_prospects_inactifs() - 'simulation',
  '{"comptes": 1, "leads": 3, "rendez_vous": 1, "consentements": 2}'::jsonb,
  'la purge supprime le compte inactif, ses données et les leads sans compte'
);

select is(
  (select count(*) from public.profiles where id = '0e000000-0000-0000-0000-000000000001')::int, 0,
  'le compte inactif a disparu, profil compris'
);

select is(
  (select count(*) from public.lead_events where lead_id = '0f000000-0000-0000-0000-000000000001')::int, 0,
  'ses réponses au formulaire sont parties avec lui'
);

select is(
  (select count(*) from auth.users where id = '0e000000-0000-0000-0000-000000000002')::int, 1,
  'une connexion récente garde le compte'
);

select is(
  (select count(*) from auth.users where id = '0e000000-0000-0000-0000-000000000003')::int, 1,
  'une commande, même annulée, garde le compte'
);

select is(
  (select count(*) from auth.users where id = '0e000000-0000-0000-0000-000000000004')::int, 1,
  'un membre de l''équipe n''est jamais purgé'
);

select is(
  (select count(*) from auth.users where id = '0e000000-0000-0000-0000-000000000005')::int, 1,
  'un rendez-vous à venir garde le compte'
);

select is(
  (select count(*) from public.leads where id = '0f000000-0000-0000-0000-000000000007')::int, 1,
  'un lead gagné n''est jamais purgé'
);

select is(
  (select count(*) from public.consents where email = 'client.a@apex.test')::int, 1,
  'un consentement dont l''adresse appartient encore à un client est conservé'
);

select is(
  (select apres from public.audit_logs
   where action = 'PURGE' and enregistrement_id = '0e000000-0000-0000-0000-000000000001'),
  '{"motif": "prospect inactif depuis trois ans"}'::jsonb,
  'la purge laisse une trace, sans aucune donnée personnelle'
);

select is(
  (public.purger_prospects_inactifs() ->> 'comptes')::int, 0,
  'un second passage ne trouve plus rien'
);

-- Elle supprime des comptes : aucune session ne doit pouvoir l'appeler.
select ok(
  not has_function_privilege('authenticated', 'public.purger_prospects_inactifs(boolean)', 'execute'),
  'un utilisateur connecté ne peut pas lancer la purge'
);

select * from finish();
rollback;
