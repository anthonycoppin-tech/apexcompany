-- ═══════════════════════════════════════════════════════════════════════════
-- Annonces d'événement : ce que l'accueil a le droit d'afficher.
--
-- Une annonce échue en tête de l'accueil affirmerait un événement qui a déjà
-- eu lieu. La politique de lecture publique filtre l'échéance, et c'est ce qui
-- est vérifié ici — avec des lignes créées pour le test, indépendantes de
-- l'annonce réelle insérée par la migration, qui s'échoit d'elle-même.
--
-- Miroir pgTAP de ce que `scripts/verifier-schema.mjs` rejoue en PGlite. Les
-- deux se maintiennent ensemble : une règle ajoutée ici doit l'être là-bas.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
select plan(7);

insert into public.annonces (titre, publiee, fin_affichage) values
  ('verif-en-cours', true, now() + interval '1 day'),
  ('verif-echue', true, now() - interval '1 minute'),
  ('verif-brouillon', false, now() + interval '1 day');

-- ── Le visiteur anonyme ────────────────────────────────────────────────────

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is(
  (select count(*)::int from public.annonces where titre like 'verif-%'),
  1,
  'un visiteur ne voit que lannonce publiée et non échue'
);

-- ── Le staff ───────────────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.annonces where titre like 'verif-%'),
  3,
  'ladmin voit les trois, échue et brouillon compris'
);

select lives_ok(
  $$insert into public.annonces (titre, publiee, fin_affichage)
    values ('verif-staff', true, now() + interval '1 day')$$,
  'le staff publie une annonce'
);

select throws_ok(
  $$insert into public.annonces (titre, publiee) values ('verif-sans-fin', true)$$,
  '23502',
  null,
  'une annonce sans fin daffichage est refusée'
);

select throws_ok(
  $$insert into public.annonces (titre, fin_affichage, lien_url, lien_libelle)
    values ('verif-lien', now(), 'javascript:alert(1)', 'Clic')$$,
  '23514',
  null,
  'un lien qui nest ni un chemin ni du HTTPS est refusé'
);

-- ── Le formateur employé ───────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select throws_ok(
  $$insert into public.annonces (titre, publiee, fin_affichage)
    values ('verif-formateur', true, now() + interval '1 day')$$,
  '42501',
  null,
  'un formateur ne peut pas publier dannonce'
);

-- Un `update` ne lève rien quand la politique ne rend aucune ligne visible :
-- on vérifie l'effet, jamais le message.
update public.annonces set titre = 'verif-detournee' where titre = 'verif-en-cours';

reset role;

select is(
  (select count(*)::int from public.annonces where titre = 'verif-detournee'),
  0,
  'un formateur ne peut pas modifier une annonce'
);

select * from finish();
rollback;
