-- ═══════════════════════════════════════════════════════════════════════════
-- Discord et traçabilité
-- ═══════════════════════════════════════════════════════════════════════════

create table public.discord_links (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references public.profiles (id) on delete cascade,
  discord_user_id  text not null unique,
  discord_username text,
  roles_attribues  jsonb not null default '[]'::jsonb,
  linked_at        timestamptz not null default now(),
  derniere_sync    timestamptz
);

comment on column public.discord_links.discord_user_id is
  'UNIQUE des deux côtés : un compte Discord ne peut être lié quà un seul compte '
  'plateforme, et réciproquement. Sans cela, deux clients partagent un accès Discord '
  'et vous vendez une place pour deux personnes.';

create index discord_links_derniere_sync_idx on public.discord_links (derniere_sync nulls first);

-- ───────────────────────────────────────────────────────────────────────────
-- La file. Pas un appel direct.
-- ───────────────────────────────────────────────────────────────────────────

create table public.discord_sync_queue (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  action        public.discord_action not null,
  role_id       text not null,
  statut        public.queue_statut not null default 'en_attente',
  tentatives    integer not null default 0,
  prochain_essai timestamptz not null default now(),
  erreur        text,
  created_at    timestamptz not null default now(),
  traite_at     timestamptz
);

comment on table public.discord_sync_queue is
  'API Discord est limitée en débit et peut être indisponible. Sans file, un paiement '
  'pendant une coupure Discord donne un client sans accès et aucune trace de la '
  'défaillance. Le worker consomme cette table avec un backoff sur prochain_essai ; '
  'après plusieurs échecs la ligne passe en abandonne et remonte dans admin/logs, où '
  'un humain peut attribuer le rôle à la main.';

-- Index de consommation du worker : les lignes à traiter, dans l ordre.
create index discord_sync_queue_a_traiter_idx
  on public.discord_sync_queue (prochain_essai)
  where statut in ('en_attente', 'echoue');

create index discord_sync_queue_user_id_idx on public.discord_sync_queue (user_id, created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- Traçabilité
-- ───────────────────────────────────────────────────────────────────────────

create table public.automation_logs (
  id          uuid primary key default gen_random_uuid(),
  declencheur text not null,
  entite_type text,
  entite_id   uuid,
  statut      public.automation_statut not null,
  details     jsonb not null default '{}'::jsonb,
  duree_ms    integer,
  created_at  timestamptz not null default now()
);

create index automation_logs_created_at_idx on public.automation_logs (created_at desc);
create index automation_logs_declencheur_idx on public.automation_logs (declencheur, created_at desc);
create index automation_logs_echecs_idx on public.automation_logs (created_at desc)
  where statut = 'echec';

create table public.audit_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles (id) on delete set null,
  action            text not null,
  table_cible       text not null,
  enregistrement_id uuid,
  avant             jsonb,
  apres             jsonb,
  ip                inet,
  user_agent        text,
  created_at        timestamptz not null default now()
);

comment on table public.audit_logs is
  'Actions sensibles uniquement : changement de rôle, remboursement, modification de '
  'tarif, suppression. Journaliser toutes les écritures produit un volume qui rend le '
  'journal inutilisable le jour où on en a besoin.';

create index audit_logs_created_at_idx  on public.audit_logs (created_at desc);
create index audit_logs_user_id_idx     on public.audit_logs (user_id, created_at desc);
create index audit_logs_table_cible_idx on public.audit_logs (table_cible, enregistrement_id);

create table public.consents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles (id) on delete set null,
  email         text,
  type          public.consent_type not null,
  accorde       boolean not null,
  version_texte text not null,
  ip            inet,
  created_at    timestamptz not null default now(),
  constraint consents_identifie check (user_id is not null or email is not null)
);

comment on table public.consents is
  'Append-only. Un consentement retiré sécrit comme une nouvelle ligne accorde=false, '
  'jamais comme une mise à jour : la preuve exigée par le RGPD est historique, pas un '
  'état courant.';

create index consents_user_id_idx on public.consents (user_id, created_at desc);
create index consents_email_idx   on public.consents (lower(email));

-- ───────────────────────────────────────────────────────────────────────────
-- Trigger d audit, à poser sur les tables sensibles
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.trace_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (user_id, action, table_cible, enregistrement_id, avant, apres)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    case tg_op when 'DELETE' then old.id else new.id end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return case tg_op when 'DELETE' then old else new end;
end;
$$;

create trigger audit_user_roles
  after insert or update or delete on public.user_roles
  for each row execute function public.trace_audit();

create trigger audit_refunds
  after insert or update on public.refunds
  for each row execute function public.trace_audit();

create trigger audit_offres
  after update on public.offres
  for each row execute function public.trace_audit();

alter table public.discord_links      enable row level security;
alter table public.discord_sync_queue enable row level security;
alter table public.automation_logs    enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.consents           enable row level security;
