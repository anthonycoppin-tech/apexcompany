-- ═══════════════════════════════════════════════════════════════════════════
-- Le registre des emails transactionnels
--
-- Deux garanties : un même email ne se réserve qu'une fois, et personne
-- d'autre que le staff ne lit les adresses qui y sont consignées.
-- scripts/verifier-schema.mjs rejoue les mêmes vérifications sur PGlite.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
select plan(4);

insert into public.emails_envoyes (modele, cle, user_id, destinataire)
values ('paiement', 'd0000000-0000-0000-0000-00000000000a',
        '66666666-6666-6666-6666-666666666666', 'client.a@apex.test');

select throws_ok(
  $$insert into public.emails_envoyes (modele, cle, user_id, destinataire)
    values ('paiement', 'd0000000-0000-0000-0000-00000000000a',
            '66666666-6666-6666-6666-666666666666', 'client.a@apex.test')$$,
  '23505',
  null,
  'un même email ne se réserve qu''une fois'
);

set local role authenticated;

set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
select is(
  (select count(*) from public.emails_envoyes)::int, 0,
  'un client ne lit pas le registre, pas même ses propres lignes'
);

select throws_ok(
  $$insert into public.emails_envoyes (modele, cle, user_id, destinataire)
    values ('test', 'x', '66666666-6666-6666-6666-666666666666', 'x@example.com')$$,
  '42501',
  null,
  'personne n''écrit dans le registre par l''API'
);

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is(
  (select count(*) from public.emails_envoyes)::int, 1,
  'le staff lit le registre'
);

select * from finish();
rollback;
