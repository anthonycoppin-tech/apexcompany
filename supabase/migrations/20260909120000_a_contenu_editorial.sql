-- ═══════════════════════════════════════════════════════════════════════════
-- Contenu éditorial : témoignages et fiches formateurs
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Deux blocs de contenu attendaient « du contenu client » et n'existaient donc
-- nulle part : aucun témoignage sur le site, et `/formateurs` décrivant le
-- fonctionnement du suivi faute de biographies. Les écrire en dur dans les
-- pages aurait demandé un déploiement à chaque correction de virgule, et un
-- développeur pour chaque nouvel avis.
--
-- Ils changent plus souvent que le code : ils vont donc en base, éditables
-- depuis le back-office, exactement comme le catalogue. C'est ce que la page
-- `/formateurs` annonçait déjà en commentaire, et c'est la façon dont les
-- écoles comparables tiennent des pages denses en preuves sans mobiliser leurs
-- développeurs.

-- ── Témoignages ─────────────────────────────────────────────────────────────

create table public.temoignages (
  id           uuid primary key default gen_random_uuid(),
  auteur       text not null,
  contexte     text,
  contenu      text not null,
  note         smallint,
  formation_id uuid references public.formations (id) on delete set null,
  consentement boolean not null default false,
  publie       boolean not null default false,
  ordre        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint temoignages_note_bornee check (note is null or note between 1 and 5),
  constraint temoignages_publie_avec_consentement check (not publie or consentement)
);

comment on table public.temoignages is
  'Paroles de clients affichées sur le site public. Saisies au back-office, jamais en dur '
  'dans une page : elles arrivent au fil de l''eau et se corrigent sans déploiement.';

comment on column public.temoignages.contexte is
  'Ce qui situe la personne — « Accompagnement 3 mois », « Abonnement communauté ». Un '
  'témoignage sans contexte ne se vérifie pas et convainc moins.';

comment on column public.temoignages.formation_id is
  'La formation concernée, quand il y en a une. `on delete set null` : retirer un produit '
  'du catalogue ne doit pas effacer ce qu''un client en a dit.';

comment on constraint temoignages_publie_avec_consentement on public.temoignages is
  'Publier le nom et les mots d''une personne est un traitement de données personnelles. La '
  'contrainte rend l''oubli impossible, plutôt que de compter sur la vigilance de qui saisit.';

create trigger temoignages_set_updated_at
  before update on public.temoignages
  for each row execute function public.set_updated_at();

create index temoignages_publie_ordre_idx on public.temoignages (publie, ordre);

-- ── Fiches formateurs ───────────────────────────────────────────────────────

create table public.formateurs_fiches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references public.profiles (id) on delete set null,
  nom         text not null,
  fonction    text,
  biographie  text,
  specialites text[] not null default '{}',
  photo_url   text,
  publie      boolean not null default false,
  ordre       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.formateurs_fiches is
  'Fiches publiques de l''équipe. Séparées de `profiles`, qui porte le compte : une fiche '
  'peut exister sans compte, et un compte n''a pas vocation à être publié.';

comment on column public.formateurs_fiches.user_id is
  'Rattachement facultatif au compte du formateur. `on delete set null` : un départ ne doit '
  'pas faire disparaître une page publique sans prévenir — la fiche se dépublie à la main.';

comment on column public.formateurs_fiches.photo_url is
  'Photo publique par nature, donc une URL suffit. La règle « jamais d''URL en base » vise '
  'les vidéos à accès restreint, dont l''adresse doit être signée à la demande.';

create trigger formateurs_fiches_set_updated_at
  before update on public.formateurs_fiches
  for each row execute function public.set_updated_at();

create index formateurs_fiches_publie_ordre_idx on public.formateurs_fiches (publie, ordre);

-- ── Traçabilité ─────────────────────────────────────────────────────────────
--
-- Comme le catalogue : ce qui s'affiche publiquement et engage la société se
-- trace à la modification. Qui a publié quel témoignage, et quand.

create trigger audit_temoignages
  after update on public.temoignages
  for each row execute function public.trace_audit();

create trigger audit_formateurs_fiches
  after update on public.formateurs_fiches
  for each row execute function public.trace_audit();

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Même découpage que `formations` : le public ne voit que ce qui est publié,
-- le staff voit et écrit tout. Un brouillon de témoignage — recueilli, pas
-- encore autorisé — ne doit pas fuiter par une requête anonyme.

alter table public.temoignages        enable row level security;
alter table public.formateurs_fiches  enable row level security;

create policy temoignages_publies_en_lecture on public.temoignages
  for select to anon, authenticated
  using (publie);

create policy temoignages_interne_lit_tout on public.temoignages
  for select to authenticated
  using (public.is_staff());

create policy temoignages_staff_ecrit on public.temoignages
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy formateurs_fiches_publiees_en_lecture on public.formateurs_fiches
  for select to anon, authenticated
  using (publie);

create policy formateurs_fiches_interne_lit_tout on public.formateurs_fiches
  for select to authenticated
  using (public.is_staff());

create policy formateurs_fiches_staff_ecrit on public.formateurs_fiches
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Un formateur ne modifie pas sa propre fiche : elle engage la société autant
-- qu'une page de vente, et l'invariant « un formateur ne voit que ses
-- affectations » n'a pas à s'élargir pour du texte de présentation. Si le
-- besoin se confirme, ce sera une politique explicite, pas un effet de bord.
