-- ═══════════════════════════════════════════════════════════════════════════
-- Révision 3 — la proposition commerciale et l'abonnement
--
-- Deux tables, deux raisons distinctes :
--
-- `propositions` remplace le lien de paiement collé à la main à la fin de
-- l'audit. C'est elle qui rend la conversion mesurable — qui a proposé quoi, à
-- quel prix, et est-ce que ça a été payé (01-CAHIER-DES-CHARGES.md §3, ét. 3).
--
-- `subscriptions` parce qu'un abonnement n'est pas une commande avec une date
-- de fin : renouvellements, échecs de prélèvement, résiliation à effet différé
-- sont un cycle de vie que `orders` ne sait pas représenter.
-- ═══════════════════════════════════════════════════════════════════════════

-- Propositions ─────────────────────────────────────────────────────────────

create type public.proposition_statut as enum (
  'brouillon', 'envoyee', 'acceptee', 'refusee', 'expiree'
);

create table public.propositions (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid references public.leads (id) on delete set null,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  formation_id   uuid not null references public.formations (id) on delete restrict,
  formateur_id   uuid not null references public.profiles (id) on delete restrict,
  montant_cents  integer not null,
  devise         text not null default 'EUR',
  statut         public.proposition_statut not null default 'brouillon',
  expire_le      timestamptz,
  order_id       uuid references public.orders (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint propositions_montant_positif check (montant_cents >= 0)
);

comment on table public.propositions is
  'Émise depuis /formateur à la fin de l''audit. Le lien envoyé au client pointe vers une '
  'page authentifiée, jamais vers un jeton public : le compte existe déjà — bénéfice '
  'direct du tunnel inversé — donc la RLS suffit à protéger la proposition.';

comment on column public.propositions.expire_le is
  'Une proposition expire, et c''est volontaire : c''est un levier de vente, et ça évite '
  'qu''un lien à 5 000 € émis en janvier soit payé en septembre au tarif de janvier.';

comment on column public.propositions.montant_cents is
  'En centimes, entier. Repris du prix catalogue à l''émission. La remise accordée par un '
  'formateur n''est pas arbitrée (01-CAHIER-DES-CHARGES.md §8.6) : aucun plafond n''est '
  'donc contraint ici, et il faudra en ajouter un le jour où elle est autorisée.';

create trigger propositions_set_updated_at
  before update on public.propositions
  for each row execute function public.set_updated_at();

create index propositions_user_id_idx      on public.propositions (user_id);
create index propositions_formateur_id_idx on public.propositions (formateur_id);
create index propositions_lead_id_idx      on public.propositions (lead_id);
create index propositions_statut_idx       on public.propositions (statut);

-- Sert le job qui fait expirer les propositions dépassées.
create index propositions_a_expirer_idx on public.propositions (expire_le)
  where statut = 'envoyee';

-- Abonnements ──────────────────────────────────────────────────────────────

create type public.subscription_statut as enum (
  'active', 'impayee', 'resiliee', 'terminee'
);

create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  formation_id             uuid not null references public.formations (id) on delete restrict,
  inscription_id           uuid references public.inscriptions (id) on delete set null,
  provider                 public.payment_provider not null,
  provider_subscription_id text not null,
  statut                   public.subscription_statut not null default 'active',
  periode_fin              timestamptz,
  resiliation_demandee_le  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

comment on column public.subscriptions.inscription_id is
  'L''accès lui-même reste porté par inscriptions.date_fin_acces, comme pour les deux '
  'autres types de produit. Chaque renouvellement réussi la repousse d''un mois ; le '
  'worker Discord ne lit qu''une date et n''a pas à savoir ce qui a été vendu.';

comment on column public.subscriptions.resiliation_demandee_le is
  'Résiliation à effet différé : l''accès court jusqu''à periode_fin. Effacer la ligne à '
  'la demande de résiliation ferait perdre le mois déjà payé.';

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create index subscriptions_user_id_idx        on public.subscriptions (user_id);
create index subscriptions_inscription_id_idx on public.subscriptions (inscription_id);
create index subscriptions_statut_idx         on public.subscriptions (statut);

-- Sert la vue back-office « renouvellements à venir et échecs de prélèvement ».
create index subscriptions_a_renouveler_idx on public.subscriptions (periode_fin)
  where statut in ('active', 'impayee');

-- RLS ──────────────────────────────────────────────────────────────────────
-- Activée dans la même migration que le create table, sans exception.

alter table public.propositions  enable row level security;
alter table public.subscriptions enable row level security;

create policy propositions_staff on public.propositions
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Le formateur émet et suit SES propositions. C'est la seule table portant un
-- montant qui lui soit ouverte, et ça ne contredit pas « jamais d'argent » :
-- le montant est le prix catalogue, public sur la fiche produit, qu'il vient
-- lui-même de choisir. Ce qui lui reste fermé, c'est ce que le client a
-- réellement payé — orders, payments, invoices, refunds, subscriptions.
create policy propositions_formateur_lit on public.propositions
  for select to authenticated
  using (formateur_id = auth.uid());

create policy propositions_formateur_emet on public.propositions
  for insert to authenticated
  with check (formateur_id = auth.uid());

create policy propositions_formateur_modifie on public.propositions
  for update to authenticated
  using (formateur_id = auth.uid())
  with check (formateur_id = auth.uid());

create policy propositions_client_lit_les_siennes on public.propositions
  for select to authenticated
  using (user_id = auth.uid());

create policy subscriptions_staff on public.subscriptions
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy subscriptions_client_lit_les_siens on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid());
