-- ═══════════════════════════════════════════════════════════════════════════
-- Le rôle formateur est le plus délicat du modèle. Deux choses à prouver :
--   1. il ne voit rien de ce qui est affecté à un autre formateur ;
--   2. il ne voit aucune donnée financière, de personne.
--
-- Révision 3 : l'ancrage n'est plus la cohorte — elle a disparu — mais
-- l'affectation explicite, `inscriptions.formateur_id` et `leads.assigned_to`.
-- L'invariant ne s'assouplit pas pour autant, seul son énoncé change.
--
-- Ces tests tournent sur le jeu de seed : formateur A est affecté au client A
-- et à deux prospects, formateur B au client B et à deux autres prospects.
-- Un test qui casse ici signale une fuite de données, pas un test à ajuster.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
select plan(17);

-- Un remboursement, pour que le test « le formateur ne voit pas les
-- remboursements » porte sur une table non vide. Un test qui passe parce que
-- la table est vide ne teste rien.
insert into public.refunds (payment_id, montant_cents, motif, statut, demande_par)
select id, 50000, 'Test de cloisonnement', 'demande', '22222222-2222-2222-2222-222222222222'
from public.payments
where provider_payment_id = 'pi_test_seed_a';

-- On se fait passer pour le formateur A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- ── Cloisonnement entre formateurs ─────────────────────────────────────────

select is(
  (select count(*) from public.inscriptions)::int, 1,
  'formateur A ne voit que la seule inscription qui lui est affectée'
);

select is(
  (select count(*) from public.inscriptions
   where id = 'e0000000-0000-0000-0000-00000000000b')::int, 0,
  'formateur A ne voit pas linscription affectée au formateur B'
);

select is(
  (select count(*) from public.leads)::int, 2,
  'formateur A voit ses deux prospects, et aucun autre'
);

select is(
  (select count(*) from public.leads
   where assigned_to = '44444444-4444-4444-4444-444444444444')::int, 0,
  'formateur A ne voit pas les prospects du formateur B'
);

select is(
  (select count(*) from public.lead_events)::int, 2,
  'formateur A lit la soumission du formulaire de ses seuls prospects'
);

select is(
  (select count(*) from public.appointments)::int, 1,
  'formateur A ne voit que laudit dont il est le conseiller'
);

select is(
  (select count(*) from public.propositions)::int, 1,
  'formateur A ne voit que la proposition quil a émise'
);

select is(
  (select count(*) from public.suivi_notes)::int, 2,
  'formateur A voit ses deux notes de suivi, y compris la note interne'
);

select is(
  (select count(*) from public.suivi_notes
   where inscription_id = 'e0000000-0000-0000-0000-00000000000b')::int, 0,
  'formateur A ne voit pas les notes de suivi du client du formateur B'
);

select is(
  (select count(*) from public.profiles
   where id = '77777777-7777-7777-7777-777777777777')::int, 0,
  'formateur A ne voit pas le profil du client du formateur B'
);

select is(
  (select count(*) from public.profiles
   where id = '66666666-6666-6666-6666-666666666666')::int, 1,
  'formateur A voit bien le profil de son propre client'
);

-- ── Politique 3 : largent est fermé aux formateurs ────────────────────────

select is(
  (select count(*) from public.orders)::int, 0,
  'formateur A ne voit aucune commande — y compris celle de son propre client'
);

select is(
  (select count(*) from public.payments)::int, 0,
  'formateur A ne voit aucun paiement'
);

select is(
  (select count(*) from public.invoices)::int, 0,
  'formateur A ne voit aucune facture'
);

select is(
  (select count(*) from public.refunds)::int, 0,
  'formateur A ne voit aucun remboursement'
);

select is(
  (select count(*) from public.subscriptions)::int, 0,
  'formateur A ne voit aucun abonnement — le renouvellement est une donnée dargent'
);

-- ── Ce quil DOIT voir : le catalogue, brouillons compris ──────────────────
-- Il propose un produit à la fin de laudit : il lui faut le catalogue entier,
-- prix affiché compris. Ce prix est public sur la fiche produit, il ne dit
-- rien de ce que le client a payé.

select is(
  (select count(*) from public.formations)::int, 4,
  'formateur A voit tout le catalogue, y compris le produit en brouillon'
);

select * from finish();
rollback;
