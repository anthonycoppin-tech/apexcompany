-- ═══════════════════════════════════════════════════════════════════════════
-- Côté client, deux frontières comptent :
--   - il ne voit que SES données (politique 1) ;
--   - il ne voit dun suivi que ce qui a été explicitement rendu visible.
--
-- Sy ajoute le visiteur anonyme, qui ne doit voir que le catalogue actif.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
select plan(21);

-- ── Client A ───────────────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';

select is(
  (select count(*) from public.inscriptions)::int, 1,
  'client A ne voit que sa propre inscription'
);

select is(
  (select count(*) from public.inscriptions
   where user_id = '77777777-7777-7777-7777-777777777777')::int, 0,
  'client A ne voit pas linscription du client B'
);

select is(
  (select count(*) from public.suivi_notes)::int, 1,
  'client A ne voit que la note de suivi marquée visible'
);

select is(
  (select count(*) from public.suivi_notes where not visible_client)::int, 0,
  'la note interne du coach ne remonte jamais dans lespace client'
);

select is(
  (select count(*) from public.replays)::int, 1,
  'client A voit le seul replay publié de sa cohorte'
);

select is(
  (select count(*) from public.replays
   where provider_asset_id = 'seed-asset-non-publie')::int, 0,
  'un replay non publié reste invisible même pour un inscrit de la cohorte'
);

select is(
  (select count(*) from public.replays
   where provider_asset_id = 'seed-asset-cohorte-b')::int, 0,
  'client A ne voit pas le replay dune cohorte où il nest pas inscrit'
);

select is(
  (select count(*) from public.sessions)::int, 2,
  'client A voit le planning de sa cohorte'
);

select is(
  (select count(*) from public.presences)::int, 1,
  'client A ne voit que sa propre présence'
);

select is(
  (select count(*) from public.orders)::int, 1,
  'client A voit sa commande'
);

select is(
  (select count(*) from public.orders
   where user_id = '77777777-7777-7777-7777-777777777777')::int, 0,
  'client A ne voit pas la commande du client B'
);

select is(
  (select count(*) from public.invoices)::int, 1,
  'client A voit sa facture'
);

select is(
  (select count(*) from public.offres)::int, 2,
  'client A voit les deux offres actives, jamais celle en brouillon'
);

select is(
  (select count(*) from public.leads)::int, 0,
  'client A ne voit aucun lead'
);

select is(
  (select count(*) from public.audit_logs)::int, 0,
  'client A ne voit pas le journal daudit'
);

select is(
  (select count(*) from public.payment_events)::int, 0,
  'payment_events est inaccessible depuis lAPI, sans exception'
);

select is(
  (select count(*) from public.discord_sync_queue)::int, 0,
  'la file Discord nest pas exposée au client'
);

-- ── Client B : léchelonnement ─────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}';

select is(
  (select count(*) from public.payment_schedules)::int, 3,
  'client B voit ses trois échéances'
);

select is(
  (select count(*) from public.suivi_notes)::int, 0,
  'client B na aucune note de suivi, et ne voit pas celles du client A'
);

-- ── Visiteur anonyme ───────────────────────────────────────────────────────

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is(
  (select count(*) from public.offres)::int, 2,
  'un visiteur anonyme voit le catalogue actif'
);

select is(
  (select count(*) from public.inscriptions)::int, 0,
  'un visiteur anonyme ne voit aucune inscription'
);

select * from finish();
rollback;
