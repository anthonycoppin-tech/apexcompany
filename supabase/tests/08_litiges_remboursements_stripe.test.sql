-- ═══════════════════════════════════════════════════════════════════════════
-- Litiges et remboursements annoncés par le prestataire
--
-- Idempotence, état qui n'avance que vers l'avant, remboursement partiel qui
-- laisse l'accès, intégral qui le referme, et remboursement du back-office
-- reconnu. scripts/verifier-schema.mjs rejoue les mêmes vérifications sur PGlite.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
select plan(11);

select public.enregistrer_litige(
  'stripe', 'evt_du_1', 'charge.dispute.created', '{}'::jsonb, 'du_test',
  array['ch_inconnu', 'pi_test_seed_b'], 4900, 'ouvert', 'fraudulent', now() + interval '7 days'
);

select is(
  (select count(*) from public.disputes)::int, 1,
  'un litige Stripe est enregistré'
);

select is(
  (public.enregistrer_litige(
    'stripe', 'evt_du_1', 'charge.dispute.created', '{}'::jsonb, 'du_test',
    array['pi_test_seed_b'], 4900, 'ouvert', null, null
  ) ->> 'deja_traite')::boolean, true,
  'un litige rejoué sort sans rien faire'
);

select public.enregistrer_litige(
  'stripe', 'evt_du_2', 'charge.dispute.closed', '{}'::jsonb, 'du_test',
  array['pi_test_seed_b'], 4900, 'gagne', null, null
);
select public.enregistrer_litige(
  'stripe', 'evt_du_3', 'charge.dispute.updated', '{}'::jsonb, 'du_test',
  array['pi_test_seed_b'], 4900, 'ouvert', null, null
);

select is(
  (select statut::text from public.disputes where provider_dispute_id = 'du_test'), 'gagne',
  'un événement en retard ne rouvre pas un litige clos'
);

select is(
  (public.enregistrer_litige(
    'stripe', 'evt_du_4', 'charge.dispute.created', '{}'::jsonb, 'du_orphelin',
    array['pi_inconnu'], 100, 'ouvert', null, null
  ) ->> 'paiement_introuvable')::boolean, true,
  'un litige sur un paiement inconnu est consigné, pas inventé'
);

select public.enregistrer_remboursement_prestataire(
  'stripe', 'evt_re_1', 'refund.created', '{}'::jsonb, 're_partiel',
  array['pi_test_seed_b'], 1000
);

select is(
  (select statut::text from public.inscriptions where id = 'e0000000-0000-0000-0000-00000000000b'),
  'active',
  'un remboursement partiel fait chez Stripe laisse l''accès ouvert'
);

select public.enregistrer_remboursement_prestataire(
  'stripe', 'evt_re_2', 'refund.created', '{}'::jsonb, 're_reste',
  array['pi_test_seed_b'], 3900
);

select is(
  (select statut::text from public.inscriptions where id = 'e0000000-0000-0000-0000-00000000000b'),
  'remboursee',
  'le complément qui solde le paiement referme l''accès'
);

select is(
  (public.enregistrer_remboursement_prestataire(
    'stripe', 'evt_re_2', 'refund.created', '{}'::jsonb, 're_reste',
    array['pi_test_seed_b'], 3900
  ) ->> 'deja_traite')::boolean, true,
  'un remboursement Stripe rejoué sort sans rien faire'
);

select is(
  (public.enregistrer_remboursement_prestataire(
    'stripe', 'evt_re_3', 'refund.created', '{}'::jsonb, 're_partiel',
    array['pi_test_seed_b'], 1000
  ) ->> 'deja_connu')::boolean, true,
  'un remboursement déjà enregistré, annoncé de nouveau, est reconnu'
);

-- ── Le renouvellement enregistre ce qu'il encaisse ──────────────────────────

select public.renouveler_abonnement(
  'stripe', 'evt_renouv_1', 'invoice.paid', '{}'::jsonb, 'sub_test_seed_b', 4900, 'in_renouv_1'
);

select is(
  (select count(*) from public.payments where provider_payment_id = 'in_renouv_1')::int, 1,
  'un renouvellement enregistre son encaissement'
);

select is(
  (select count(*) from public.invoices where order_id = 'd0000000-0000-0000-0000-00000000000b')::int,
  1,
  'et émet sa facture'
);

select is(
  (public.renouveler_abonnement(
    'stripe', 'evt_renouv_1', 'invoice.paid', '{}'::jsonb, 'sub_test_seed_b', 4900, 'in_renouv_1'
  ) ->> 'deja_traite')::boolean, true,
  'un renouvellement rejoué n''encaisse rien de plus'
);

select * from finish();
rollback;
