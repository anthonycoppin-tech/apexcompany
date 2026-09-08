-- ═══════════════════════════════════════════════════════════════════════════
-- Côté client, deux frontières comptent :
--   - il ne voit que SES données (politique 1) ;
--   - il ne voit dun suivi que ce qui a été explicitement rendu visible.
--
-- Sy ajoute le visiteur anonyme, qui ne doit voir que le catalogue actif.
--
-- Révision 3 : plus de replays ni de planning de cohorte côté client — ils sont
-- sur Discord. Ce que le client lit en propre, cest son inscription, sa
-- proposition, sa commande, sa facture et son abonnement.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
select plan(22);

-- ── Client A — un accompagnement payé en une fois ──────────────────────────

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
  'la note interne du formateur ne remonte jamais dans lespace client'
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

-- La proposition est lue sur une page authentifiée, pas derrière un jeton
-- public : cest la RLS seule qui la protège.
select is(
  (select count(*) from public.propositions)::int, 1,
  'client A voit la proposition qui lui a été faite'
);

select is(
  (select count(*) from public.propositions
   where user_id = '77777777-7777-7777-7777-777777777777')::int, 0,
  'client A ne voit pas la proposition faite au client B'
);

select is(
  (select count(*) from public.subscriptions)::int, 0,
  'client A na pas dabonnement, et ne voit pas celui du client B'
);

select is(
  (select count(*) from public.formations)::int, 3,
  'client A voit les trois formations actives, jamais celle en brouillon'
);

-- La matrice daccès lui donne ses rendez-vous. La politique passe par une
-- fonction SECURITY DEFINER : une sous-requête sur `leads` écrite directement
-- dans le `using` serait soumise à la RLS de `leads`, à laquelle le client na
-- aucun accès — elle ne verrait rien et refuserait tout en silence.
select is(
  (select count(*) from public.appointments)::int, 1,
  'client A voit son audit'
);

select is(
  (select count(*) from public.appointments where cal_booking_id = 'cal_seed_b')::int, 0,
  'client A ne voit pas laudit dun autre'
);

select is(
  (select count(*) from public.leads)::int, 0,
  'client A ne voit aucun lead — pas même la fiche issue de sa propre candidature'
);

select is(
  (select count(*) from public.lead_events)::int, 0,
  'client A ne relit pas sa soumission de formulaire depuis lAPI'
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

-- ── Client B — un abonnement mensuel ───────────────────────────────────────

set local request.jwt.claims = '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}';

select is(
  (select count(*) from public.subscriptions)::int, 1,
  'client B voit son abonnement, sa période et sa résiliation éventuelle'
);

select is(
  (select count(*) from public.suivi_notes)::int, 0,
  'client B na aucune note visible, et ne voit pas celles du client A'
);

-- ── Visiteur anonyme ───────────────────────────────────────────────────────

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is(
  (select count(*) from public.formations)::int, 3,
  'un visiteur anonyme voit le catalogue actif'
);

select is(
  (select count(*) from public.propositions)::int, 0,
  'un visiteur anonyme ne voit aucune proposition'
);

select * from finish();
rollback;
