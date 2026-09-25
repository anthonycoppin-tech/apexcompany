-- ═══════════════════════════════════════════════════════════════════════════
-- Annonces d'événement sur l'accueil — 25 septembre 2026
--
-- Demandé par le client à la présentation : le premier bloc de l'accueil doit
-- pouvoir annoncer un événement (le challenge du 15 octobre en premier). Une
-- table plutôt qu'un texte dans le code : c'est le client qui les écrira, depuis
-- le back-office, sans attendre un déploiement.
--
-- **Une annonce a toujours une fin d'affichage**, et c'est la raison d'être
-- de cette migration plus que la table elle-même. Un événement passé qui reste
-- en tête de l'accueil est une page qui affirme ce qui n'est plus — la famille
-- de défauts que ce dépôt s'applique à rendre impossibles plutôt qu'à
-- surveiller. La colonne est obligatoire, et c'est la politique de lecture
-- publique qui la fait respecter, pas l'écran.
--
-- Aucune réservation de place : les événements restent hors périmètre
-- (tranché le 23 septembre). Une annonce informe et renvoie vers un lien.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.annonces (
  id             uuid primary key default gen_random_uuid(),
  surtitre       text,
  titre          text not null check (length(trim(titre)) > 0),
  texte          text,
  date_evenement date,
  lien_url       text,
  lien_libelle   text,
  publiee        boolean not null default false,
  fin_affichage  timestamptz not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Un lien sans libellé donnerait un bouton vide ; un libellé sans lien, un
  -- bouton qui ne mène nulle part.
  constraint annonces_lien_complet
    check ((lien_url is null) = (lien_libelle is null)),

  -- Un chemin du site ou une adresse HTTPS : ni `javascript:`, ni `http://`.
  constraint annonces_lien_sur
    check (lien_url is null or lien_url ~ '^(/|https://)')
);

comment on table public.annonces is
  'Annonces d''événement du premier bloc de l''accueil. Écrites par le staff depuis '
  '/admin/annonces ; le public ne lit que ce qui est publié et pas encore échu.';

comment on column public.annonces.fin_affichage is
  'Obligatoire : une annonce disparaît d''elle-même à cette date. Un événement passé en '
  'tête de l''accueil serait une affirmation fausse, et personne ne pense à dépublier.';

create trigger annonces_set_updated_at
  before update on public.annonces
  for each row execute function public.set_updated_at();

create trigger audit_annonces
  after update or delete on public.annonces
  for each row execute function public.trace_audit();

create index annonces_publiee_fin_idx on public.annonces (publiee, fin_affichage);

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Même découpage que les témoignages : le public ne voit que ce qui est
-- publié, le staff voit et écrit tout. L'échéance est dans la politique : une
-- page qui oublierait de filtrer ne pourrait pas afficher une annonce échue.

alter table public.annonces enable row level security;

create policy annonces_publiees_en_lecture on public.annonces
  for select to anon, authenticated
  using (publiee and fin_affichage > now());

create policy annonces_interne_lit_tout on public.annonces
  for select to authenticated
  using (public.is_staff());

create policy annonces_staff_ecrit on public.annonces
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ── La première : le challenge du 15 octobre ────────────────────────────────
--
-- L'exemple donné par le client. Le texte ne promet rien qu'on ne sache : ni
-- programme, ni horaire, ni prix — le client le complétera depuis le
-- back-office. Il s'efface le 16 octobre à minuit, heure de Paris.

insert into public.annonces
  (surtitre, titre, texte, date_evenement, lien_url, lien_libelle, publiee, fin_affichage)
values
  ('Événement',
   'Le challenge APEX',
   'Une journée pour trader aux côtés de l''équipe, en direct sur Discord. Créez votre compte pour être prévenu dès l''ouverture des inscriptions.',
   date '2026-10-15',
   '/inscription',
   'Je veux participer',
   true,
   timestamptz '2026-10-16 00:00:00 Europe/Paris');
