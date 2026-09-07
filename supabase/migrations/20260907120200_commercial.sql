-- ═══════════════════════════════════════════════════════════════════════════
-- Commercial : leads, historique, rendez-vous
-- ═══════════════════════════════════════════════════════════════════════════

create table public.leads (
  id                    uuid primary key default gen_random_uuid(),
  email                 text not null,
  prenom                text,
  nom                   text,
  telephone             text,
  source                public.lead_source not null default 'direct',
  utm                   jsonb not null default '{}'::jsonb,
  statut                public.lead_statut not null default 'nouveau',
  offre_recommandee_id  uuid,  -- FK ajoutée après création de public.offres
  assigned_to           uuid references public.profiles (id) on delete set null,
  converti_user_id      uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on column public.leads.source is
  'Renseigné au premier contact, jamais écrasé ensuite — c''est la réponse au besoin du '
  'pôle branding : savoir quel réseau convertit réellement. Verrouillé par trigger.';

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

create index leads_statut_idx      on public.leads (statut);
create index leads_source_idx      on public.leads (source);
create index leads_assigned_to_idx on public.leads (assigned_to);
create index leads_email_idx       on public.leads (lower(email));
create index leads_created_at_idx  on public.leads (created_at desc);

-- Verrou d'attribution ─────────────────────────────────────────────────────
-- Un lead réattribué à « direct » par une mise à jour distraite, et la statistique
-- de conversion par réseau ne vaut plus rien. On l'empêche au niveau du moteur.

create or replace function public.leads_verrouille_source()
returns trigger
language plpgsql
as $$
begin
  if new.source is distinct from old.source then
    raise exception
      'La source d''un lead est définitive (tentative : % -> %)', old.source, new.source
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger leads_source_immuable
  before update on public.leads
  for each row execute function public.leads_verrouille_source();

-- Historique immuable ──────────────────────────────────────────────────────

create table public.lead_events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.lead_events is
  'Journal append-only du parcours d''un lead. Aucune politique UPDATE ni DELETE n''est '
  'écrite pour cette table : ce qui la rend réellement immuable.';

create index lead_events_lead_id_idx on public.lead_events (lead_id, created_at desc);

-- Rendez-vous (Cal.com) ────────────────────────────────────────────────────

create table public.appointments (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid references public.leads (id) on delete set null,
  cal_booking_id  text not null unique,
  debut           timestamptz not null,
  fin             timestamptz not null,
  statut          public.appointment_statut not null default 'planifie',
  conseiller_id   uuid references public.profiles (id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint appointments_creneau_coherent check (fin > debut)
);

comment on column public.appointments.cal_booking_id is
  'UNIQUE : c''est la clé d''idempotence du webhook Cal.com. Un même booking rejoué '
  'met à jour la ligne existante au lieu d''en créer une seconde.';

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create index appointments_lead_id_idx     on public.appointments (lead_id);
create index appointments_debut_idx       on public.appointments (debut);
create index appointments_conseiller_idx  on public.appointments (conseiller_id);

alter table public.leads        enable row level security;
alter table public.lead_events  enable row level security;
alter table public.appointments enable row level security;
