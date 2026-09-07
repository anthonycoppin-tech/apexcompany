-- ═══════════════════════════════════════════════════════════════════════════
-- Catalogue et cohortes
-- ═══════════════════════════════════════════════════════════════════════════

create table public.offres (
  id                          uuid primary key default gen_random_uuid(),
  slug                        text not null unique,
  titre                       text not null,
  description                 text,
  objectifs_pedagogiques      text,
  prerequis                   text,
  duree_semaines              integer,
  volume_horaire              integer,
  prix_cents                  integer not null,
  devise                      text not null default 'EUR',
  paiement_echelonne_possible boolean not null default false,
  nb_echeances_max            integer not null default 1,
  actif                       boolean not null default false,
  ordre                       integer not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint offres_prix_positif check (prix_cents >= 0),
  constraint offres_slug_format  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on column public.offres.prix_cents is
  'En centimes, entier. Jamais de flottant pour de l''argent : 0.1 + 0.2 ≠ 0.3.';

create trigger offres_set_updated_at
  before update on public.offres
  for each row execute function public.set_updated_at();

create index offres_actif_ordre_idx on public.offres (actif, ordre);

-- La FK différée du lead vers l'offre recommandée, maintenant que la table existe.
alter table public.leads
  add constraint leads_offre_recommandee_fkey
  foreign key (offre_recommandee_id) references public.offres (id) on delete set null;

create table public.cohortes (
  id               uuid primary key default gen_random_uuid(),
  offre_id         uuid not null references public.offres (id) on delete restrict,
  nom              text not null,
  date_debut       date not null,
  date_fin         date,
  places_max       integer not null default 0,
  statut           public.cohorte_statut not null default 'brouillon',
  discord_role_id  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint cohortes_dates_coherentes check (date_fin is null or date_fin >= date_debut),
  constraint cohortes_places_positives check (places_max >= 0)
);

comment on column public.cohortes.discord_role_id is
  'Identifiant du rôle Discord à attribuer. C''est ce champ qui rend la synchronisation '
  'automatique possible : sans lui, la cohorte n''a pas d''existence côté serveur Discord.';

create trigger cohortes_set_updated_at
  before update on public.cohortes
  for each row execute function public.set_updated_at();

create index cohortes_offre_id_idx on public.cohortes (offre_id);
create index cohortes_statut_idx   on public.cohortes (statut);

-- ───────────────────────────────────────────────────────────────────────────
-- La table qui porte toute la sécurité du rôle coach.
-- ───────────────────────────────────────────────────────────────────────────

create table public.cohorte_coachs (
  cohorte_id  uuid not null references public.cohortes (id) on delete cascade,
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (cohorte_id, coach_id)
);

comment on table public.cohorte_coachs is
  'Liaison coach ↔ cohorte. Toutes les politiques RLS du rôle coach s''appuient dessus : '
  'une ligne ajoutée ici ouvre un accès, une ligne retirée le referme.';

-- La PK couvre déjà (cohorte_id, coach_id). L'index inverse sert les politiques,
-- qui interrogent toujours « les cohortes de CE coach ».
create index cohorte_coachs_coach_id_idx on public.cohorte_coachs (coach_id);

create or replace function public.coach_de_cohorte(c uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.cohorte_coachs
    where cohorte_id = c and coach_id = auth.uid()
  );
$$;

comment on function public.coach_de_cohorte is
  'Le porteur de la session encadre-t-il cette cohorte ? Pivot de la politique 2.';

alter table public.offres         enable row level security;
alter table public.cohortes       enable row level security;
alter table public.cohorte_coachs enable row level security;
