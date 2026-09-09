-- ═══════════════════════════════════════════════════════════════════════════
-- Contenu éditorial : ce qui sort chez un visiteur, et ce qui ne doit jamais
-- en sortir.
--
-- Témoignages et fiches formateurs sont le seul endroit du schéma où du
-- brouillon et du publié cohabitent dans la même table et alimentent la même
-- page. La confusion y coûte cher : un témoignage recueilli mais pas encore
-- autorisé qui s'affiche, c'est la citation d'une personne publiée sans son
-- accord.
--
-- Miroir pgTAP de ce que `scripts/verifier-schema.mjs` rejoue en PGlite. Les
-- deux se maintiennent ensemble : une règle ajoutée ici doit l'être là-bas.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
select plan(7);

-- ── Le visiteur anonyme ────────────────────────────────────────────────────
--
-- En premier, avant que les tests de contrainte n'ajoutent des lignes : ces
-- comptes portent sur le jeu de données du seed.

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is(
  (select count(*) from public.temoignages)::int, 1,
  'un visiteur anonyme ne voit que le témoignage publié'
);

select is(
  (select count(*) from public.temoignages where not publie)::int, 0,
  'aucun brouillon de témoignage ne fuite'
);

select is(
  (select count(*) from public.formateurs_fiches)::int, 1,
  'un visiteur anonyme ne voit que la fiche formateur publiée'
);

-- ── Le staff ───────────────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.temoignages)::int, 3,
  'ladmin voit les trois témoignages, brouillons compris'
);

select is(
  (select count(*) from public.formateurs_fiches)::int, 2,
  'ladmin voit les deux fiches'
);

-- ── Le consentement conditionne la publication ─────────────────────────────
--
-- La contrainte est le garde-fou, pas l'écran de saisie : elle tient même le
-- jour où quelqu'un écrit un script d'import.

select throws_ok(
  $$insert into public.temoignages (auteur, contenu, consentement, publie)
    values ('Sans accord', 'Ne doit pas passer.', false, true)$$,
  '23514',
  null,
  'un témoignage sans consentement ne peut pas être publié'
);

select lives_ok(
  $$insert into public.temoignages (auteur, contenu, consentement, publie)
    values ('Avec accord', 'Doit passer.', true, true)$$,
  'le consentement obtenu lève le verrou'
);

select * from finish();
rollback;
