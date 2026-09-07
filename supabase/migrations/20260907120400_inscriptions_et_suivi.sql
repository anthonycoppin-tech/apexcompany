-- ═══════════════════════════════════════════════════════════════════════════
-- Inscriptions, sessions live, présences, replays, suivi individuel
-- ═══════════════════════════════════════════════════════════════════════════

create table public.inscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  offre_id        uuid not null references public.offres (id) on delete restrict,
  cohorte_id      uuid references public.cohortes (id) on delete set null,
  statut          public.inscription_statut not null default 'active',
  date_debut      date not null default current_date,
  date_fin_acces  date,
  order_id        uuid,  -- FK ajoutée après création de public.orders
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, cohorte_id)
);

comment on constraint inscriptions_user_id_cohorte_id_key on public.inscriptions is
  'Un client ne peut être inscrit deux fois à la même cohorte. Deuxième filet, après '
  'idempotence des webhooks, contre la double inscription sur paiement rejoué.';

create trigger inscriptions_set_updated_at
  before update on public.inscriptions
  for each row execute function public.set_updated_at();

-- Ces index servent les politiques RLS. Une politique s évalue ligne à ligne :
-- sans eux, les performances s effondrent dès quelques milliers de lignes.
create index inscriptions_user_id_idx    on public.inscriptions (user_id);
create index inscriptions_cohorte_id_idx on public.inscriptions (cohorte_id);
create index inscriptions_statut_idx     on public.inscriptions (statut);
create index inscriptions_order_id_idx   on public.inscriptions (order_id);

-- Helpers dérivés ──────────────────────────────────────────────────────────

create or replace function public.est_mon_inscription(i uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.inscriptions
    where id = i and user_id = auth.uid()
  );
$$;

create or replace function public.coach_de_inscription(i uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.inscriptions ins
    join public.cohorte_coachs cc on cc.cohorte_id = ins.cohorte_id
    where ins.id = i and cc.coach_id = auth.uid()
  );
$$;

-- Sessions live ────────────────────────────────────────────────────────────

create table public.sessions (
  id             uuid primary key default gen_random_uuid(),
  cohorte_id     uuid not null references public.cohortes (id) on delete cascade,
  titre          text not null,
  type           public.session_type not null default 'live',
  debut          timestamptz not null,
  fin            timestamptz not null,
  coach_id       uuid references public.profiles (id) on delete set null,
  lien_discord   text,
  statut         public.session_statut not null default 'planifiee',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint sessions_creneau_coherent check (fin > debut)
);

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

create index sessions_cohorte_id_idx on public.sessions (cohorte_id, debut desc);
create index sessions_coach_id_idx   on public.sessions (coach_id);
create index sessions_debut_idx      on public.sessions (debut);

-- Déclarée ici, après public.sessions, mais utilisée par les politiques du coach.
create or replace function public.coach_de_session(s uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.sessions ses
    join public.cohorte_coachs cc on cc.cohorte_id = ses.cohorte_id
    where ses.id = s and cc.coach_id = auth.uid()
  );
$$;

-- Présences ────────────────────────────────────────────────────────────────

create table public.presences (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions (id) on delete cascade,
  inscription_id  uuid not null references public.inscriptions (id) on delete cascade,
  present         boolean not null default false,
  duree_minutes   integer,
  saisi_par       uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (session_id, inscription_id),
  constraint presences_duree_positive check (duree_minutes is null or duree_minutes >= 0)
);

create trigger presences_set_updated_at
  before update on public.presences
  for each row execute function public.set_updated_at();

create index presences_inscription_id_idx on public.presences (inscription_id);
create index presences_session_id_idx     on public.presences (session_id);

-- Replays ──────────────────────────────────────────────────────────────────

create table public.replays (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references public.sessions (id) on delete cascade,
  provider              text not null,
  provider_asset_id     text not null,
  duree_secondes        integer,
  publie                boolean not null default false,
  disponible_jusqu_au   timestamptz,
  uploaded_by           uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (provider, provider_asset_id)
);

comment on table public.replays is
  'On ne stocke JAMAIS d URL de lecture ici, seulement l identifiant de l asset chez '
  'hébergeur vidéo. URL signée, à durée courte, générée à la demande côté serveur '
  'après vérification que inscription est active. Une URL de fichier stockée en base '
  'est une URL qui finit par circuler.';

create trigger replays_set_updated_at
  before update on public.replays
  for each row execute function public.set_updated_at();

create index replays_session_id_idx on public.replays (session_id);
create index replays_publie_idx     on public.replays (publie);

-- Suivi individuel ─────────────────────────────────────────────────────────

create table public.suivi_notes (
  id              uuid primary key default gen_random_uuid(),
  inscription_id  uuid not null references public.inscriptions (id) on delete cascade,
  coach_id        uuid not null references public.profiles (id) on delete restrict,
  type            public.suivi_note_type not null default 'observation',
  contenu         text not null,
  visible_client  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.suivi_notes.visible_client is
  'Sépare les notes internes des retours destinés au client. Défaut à false : une note '
  'écrite sans y penser reste interne. Une note interne mal cloisonnée qui remonte dans '
  'espace client est le genre incident qui coûte cher.';

create trigger suivi_notes_set_updated_at
  before update on public.suivi_notes
  for each row execute function public.set_updated_at();

create index suivi_notes_inscription_id_idx on public.suivi_notes (inscription_id, created_at desc);
create index suivi_notes_coach_id_idx       on public.suivi_notes (coach_id);

-- Index partiel : la page de suivi côté client ne lit que les notes visibles.
create index suivi_notes_visibles_idx on public.suivi_notes (inscription_id)
  where visible_client;

-- Coaching individuel ──────────────────────────────────────────────────────

create table public.coaching_sessions (
  id              uuid primary key default gen_random_uuid(),
  inscription_id  uuid not null references public.inscriptions (id) on delete cascade,
  coach_id        uuid references public.profiles (id) on delete set null,
  cal_booking_id  text unique,
  debut           timestamptz not null,
  fin             timestamptz not null,
  statut          public.coaching_statut not null default 'planifiee',
  compte_rendu    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint coaching_creneau_coherent check (fin > debut)
);

create trigger coaching_sessions_set_updated_at
  before update on public.coaching_sessions
  for each row execute function public.set_updated_at();

create index coaching_sessions_inscription_id_idx on public.coaching_sessions (inscription_id);
create index coaching_sessions_coach_id_idx       on public.coaching_sessions (coach_id, debut desc);

alter table public.inscriptions      enable row level security;
alter table public.sessions          enable row level security;
alter table public.presences         enable row level security;
alter table public.replays           enable row level security;
alter table public.suivi_notes       enable row level security;
alter table public.coaching_sessions enable row level security;
