-- ═══════════════════════════════════════════════════════════════════════════
-- Paiement : commandes, encaissements, échéances, idempotence, facturation
-- ═══════════════════════════════════════════════════════════════════════════

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles (id) on delete set null,
  lead_id            uuid references public.leads (id) on delete set null,
  offre_id           uuid not null references public.offres (id) on delete restrict,
  cohorte_id         uuid references public.cohortes (id) on delete set null,
  montant_cents      integer not null,
  devise             text not null default 'EUR',
  statut             public.order_statut not null default 'brouillon',
  provider           public.payment_provider not null,
  provider_order_id  text,
  echelonne          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint orders_montant_positif check (montant_cents >= 0),
  unique (provider, provider_order_id)
);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create index orders_user_id_idx  on public.orders (user_id);
create index orders_lead_id_idx  on public.orders (lead_id);
create index orders_statut_idx   on public.orders (statut);
create index orders_created_idx  on public.orders (created_at desc);

-- La FK différée depuis inscriptions, maintenant que orders existe.
alter table public.inscriptions
  add constraint inscriptions_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete set null;

create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete restrict,
  montant_cents        integer not null,
  devise               text not null default 'EUR',
  statut               public.payment_statut not null default 'en_attente',
  provider             public.payment_provider not null,
  provider_payment_id  text,
  methode              text,
  paid_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint payments_montant_positif check (montant_cents >= 0),
  unique (provider, provider_payment_id)
);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create index payments_order_id_idx on public.payments (order_id);
create index payments_statut_idx   on public.payments (statut);
create index payments_paid_at_idx  on public.payments (paid_at desc);

create table public.payment_schedules (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  numero_echeance   integer not null,
  montant_cents     integer not null,
  date_prevue       date not null,
  statut            public.echeance_statut not null default 'a_venir',
  payment_id        uuid references public.payments (id) on delete set null,
  relances_envoyees integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (order_id, numero_echeance),
  constraint echeance_montant_positif check (montant_cents > 0),
  constraint echeance_numero_positif check (numero_echeance > 0)
);

create trigger payment_schedules_set_updated_at
  before update on public.payment_schedules
  for each row execute function public.set_updated_at();

create index payment_schedules_order_id_idx on public.payment_schedules (order_id, numero_echeance);
-- Sert le job quotidien de relance : les échéances dues, non encore réglées.
create index payment_schedules_a_relancer_idx on public.payment_schedules (date_prevue)
  where statut in ('a_venir', 'due', 'echouee');

-- ───────────────────────────────────────────────────────────────────────────
-- Idempotence des webhooks
-- ───────────────────────────────────────────────────────────────────────────

create table public.payment_events (
  id                 uuid primary key default gen_random_uuid(),
  provider           public.payment_provider not null,
  provider_event_id  text not null,
  type               text not null,
  payload            jsonb not null default '{}'::jsonb,
  recu_at            timestamptz not null default now(),
  traite_at          timestamptz,
  erreur             text,
  tentatives         integer not null default 0,
  unique (provider, provider_event_id)
);

comment on table public.payment_events is
  'La contrainte unique sur (provider, provider_event_id) est ce qui empêche un webhook '
  'rejoué de créer deux inscriptions. Le handler insère ICI EN PREMIER, dans la même '
  'transaction que le traitement métier ; si insertion viole la contrainte, événement a '
  'déjà été vu et on sort sans rien faire. Stripe et PayPal rejouent tous les deux : ce '
  'nest pas une hypothèse défensive, cest le fonctionnement normal.';

comment on column public.payment_events.traite_at is
  'NULL tant que le traitement métier na pas abouti. Une ligne insérée mais jamais '
  'marquée traitée signale un handler qui a planté en cours de route : cest ce que '
  'admin/logs doit remonter.';

create index payment_events_non_traites_idx on public.payment_events (recu_at)
  where traite_at is null;
create index payment_events_type_idx on public.payment_events (type, recu_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- Facturation : numérotation continue, sans trou, obligation légale
-- ───────────────────────────────────────────────────────────────────────────

create sequence public.invoice_numero_seq as bigint start 1;

create table public.invoices (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete restrict,
  numero     text not null unique,
  pdf_url    text,
  emise_at   timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on column public.invoices.numero is
  'Séquence continue, sans trou, non réutilisable : obligation légale française. '
  'Généré par trigger à partir de invoice_numero_seq, jamais fourni par le client. '
  'Attention : une transaction annulée consomme quand même le numéro. Cest voulu — '
  'un trou justifiable vaut mieux quun doublon, et la facture ne sémet quaprès '
  'encaissement confirmé.';

create index invoices_order_id_idx on public.invoices (order_id);
create index invoices_emise_at_idx on public.invoices (emise_at desc);

create or replace function public.invoices_attribue_numero()
returns trigger
language plpgsql
as $$
begin
  if new.numero is null or new.numero = '' then
    new.numero := to_char(now(), 'YYYY') || '-' ||
                  lpad(nextval('public.invoice_numero_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger invoices_numerotation
  before insert on public.invoices
  for each row execute function public.invoices_attribue_numero();

-- Une facture émise ne se modifie pas et ne se supprime pas. On émet un avoir.
create or replace function public.invoices_immuables()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Une facture émise est immuable. Emettre un avoir (refunds) à la place.'
    using errcode = 'restrict_violation';
end;
$$;

create trigger invoices_pas_de_suppression
  before delete on public.invoices
  for each row execute function public.invoices_immuables();

create table public.refunds (
  id             uuid primary key default gen_random_uuid(),
  payment_id     uuid not null references public.payments (id) on delete restrict,
  montant_cents  integer not null,
  motif          text,
  statut         public.refund_statut not null default 'demande',
  demande_par    uuid references public.profiles (id) on delete set null,
  traite_par     uuid references public.profiles (id) on delete set null,
  traite_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint refunds_montant_positif check (montant_cents > 0)
);

create trigger refunds_set_updated_at
  before update on public.refunds
  for each row execute function public.set_updated_at();

create index refunds_payment_id_idx on public.refunds (payment_id);
create index refunds_statut_idx     on public.refunds (statut);

create table public.disputes (
  id                   uuid primary key default gen_random_uuid(),
  payment_id           uuid not null references public.payments (id) on delete restrict,
  provider_dispute_id  text not null unique,
  montant_cents        integer not null,
  statut               public.dispute_statut not null default 'ouvert',
  motif                text,
  deadline_reponse     timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on column public.disputes.deadline_reponse is
  'Fournie par le prestataire. Dépassée sans réponse, le litige est perdu par défaut : '
  'cest une alerte du tableau de bord admin, pas une simple colonne.';

create trigger disputes_set_updated_at
  before update on public.disputes
  for each row execute function public.set_updated_at();

create index disputes_payment_id_idx on public.disputes (payment_id);
create index disputes_deadline_idx   on public.disputes (deadline_reponse)
  where statut in ('ouvert', 'preuves_envoyees');

alter table public.orders            enable row level security;
alter table public.payments          enable row level security;
alter table public.payment_schedules enable row level security;
alter table public.payment_events    enable row level security;
alter table public.invoices          enable row level security;
alter table public.refunds           enable row level security;
alter table public.disputes          enable row level security;
