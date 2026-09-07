-- ═══════════════════════════════════════════════════════════════════════════
-- Le rôle coach est le plus délicat du modèle. Deux choses à prouver :
--   1. il ne voit rien de la cohorte de lautre coach ;
--   2. il ne voit aucune donnée financière, de personne.
--
-- Ces tests tournent sur le jeu de seed : coach A encadre la cohorte A
-- (client A), coach B encadre la cohorte B (client B).
-- ═══════════════════════════════════════════════════════════════════════════

begin;
select plan(17);

-- Un remboursement, pour que le test « le coach ne voit pas les
-- remboursements » porte sur une table non vide. Un test qui passe parce que
-- la table est vide ne teste rien.
insert into public.refunds (payment_id, montant_cents, motif, statut, demande_par)
select id, 50000, 'Test de cloisonnement', 'demande', '22222222-2222-2222-2222-222222222222'
from public.payments
where provider_payment_id = 'pi_test_seed_a';

-- On se fait passer pour le coach A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- ── Cloisonnement entre coachs ─────────────────────────────────────────────

select is(
  (select count(*) from public.inscriptions)::int, 1,
  'coach A ne voit que la seule inscription de sa cohorte'
);

select is(
  (select count(*) from public.inscriptions
   where id = 'e0000000-0000-0000-0000-00000000000b')::int, 0,
  'coach A ne voit pas linscription de la cohorte du coach B'
);

select is(
  (select count(*) from public.cohortes)::int, 1,
  'coach A ne voit que sa propre cohorte'
);

select is(
  (select count(*) from public.sessions)::int, 2,
  'coach A voit les deux sessions de sa cohorte, et aucune autre'
);

select is(
  (select count(*) from public.sessions
   where cohorte_id = 'c0000000-0000-0000-0000-00000000000b')::int, 0,
  'coach A ne voit pas les sessions de la cohorte B'
);

select is(
  (select count(*) from public.replays)::int, 2,
  'coach A voit les replays de ses sessions, publiés ou non'
);

select is(
  (select count(*) from public.replays
   where provider_asset_id = 'seed-asset-cohorte-b')::int, 0,
  'coach A ne voit pas le replay de la cohorte B'
);

select is(
  (select count(*) from public.suivi_notes)::int, 2,
  'coach A voit ses deux notes de suivi, y compris la note interne'
);

select is(
  (select count(*) from public.suivi_notes
   where inscription_id = 'e0000000-0000-0000-0000-00000000000b')::int, 0,
  'coach A ne voit pas les notes de suivi du client du coach B'
);

select is(
  (select count(*) from public.profiles
   where id = '77777777-7777-7777-7777-777777777777')::int, 0,
  'coach A ne voit pas le profil du client du coach B'
);

select is(
  (select count(*) from public.profiles
   where id = '66666666-6666-6666-6666-666666666666')::int, 1,
  'coach A voit bien le profil de son propre apprenant'
);

-- ── Politique 3 : largent est fermé aux coachs ────────────────────────────

select is(
  (select count(*) from public.orders)::int, 0,
  'coach A ne voit aucune commande — y compris celles de son propre apprenant'
);

select is(
  (select count(*) from public.payments)::int, 0,
  'coach A ne voit aucun paiement'
);

select is(
  (select count(*) from public.payment_schedules)::int, 0,
  'coach A ne voit aucune échéance de paiement'
);

select is(
  (select count(*) from public.invoices)::int, 0,
  'coach A ne voit aucune facture'
);

select is(
  (select count(*) from public.refunds)::int, 0,
  'coach A ne voit aucun remboursement'
);

-- ── Commercial et audit ────────────────────────────────────────────────────

select is(
  (select count(*) from public.leads)::int, 0,
  'coach A ne voit aucun lead'
);

select * from finish();
rollback;
