-- ═══════════════════════════════════════════════════════════════════════════
-- Identité, rôles, et les fonctions sur lesquelles repose toute la RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- Horodatage automatique ───────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tables ───────────────────────────────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  prenom      text,
  nom         text,
  telephone   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Données publiques de compte. Le mot de passe et l''identité vivent dans auth.users.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.app_role not null,
  granted_by  uuid references public.profiles (id) on delete set null,
  granted_at  timestamptz not null default now(),
  unique (user_id, role)
);

comment on table public.user_roles is
  'Les rôles vivent dans leur propre table, jamais dans profiles ni dans les métadonnées '
  'du JWT : une colonne de rôle éditable par le porteur du compte est une élévation de '
  'privilège offerte.';

create index user_roles_user_id_idx on public.user_roles (user_id);
create index user_roles_role_idx on public.user_roles (role);

-- Fonctions de sécurité ────────────────────────────────────────────────────
-- SECURITY DEFINER : elles lisent user_roles en contournant la RLS, ce qui évite
-- la récursion infinie d'une politique sur user_roles qui interrogerait user_roles.
-- search_path figé : sans ça, un schéma temporaire peut détourner l'appel.

create or replace function public.has_role(r public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = r
  );
$$;

comment on function public.has_role is 'Le porteur de la session détient-il ce rôle ?';

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'owner')
  );
$$;

comment on function public.is_staff is
  'Raccourci admin OU owner. Présent dans presque toutes les politiques : le garder en '
  'une seule fonction évite d''avoir à corriger cinquante politiques le jour où la '
  'définition de « staff » change.';

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'owner'
  );
$$;

-- Provisionnement automatique du compte ────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, prenom, nom)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'prenom',
    new.raw_user_meta_data ->> 'nom'
  );

  -- Tout compte naît « client ». Les rôles internes sont accordés explicitement
  -- par un owner, jamais déduits de l'inscription.
  insert into public.user_roles (user_id, role)
  values (new.id, 'client');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS activée d'emblée. Une table sans politique est inaccessible : c'est le bon défaut.
alter table public.profiles   enable row level security;
alter table public.user_roles enable row level security;
