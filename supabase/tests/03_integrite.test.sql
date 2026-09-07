-- ═══════════════════════════════════════════════════════════════════════════
-- Les garanties qui ne relèvent pas de la RLS mais qui coûtent aussi cher
-- quand elles cèdent : idempotence des webhooks, numérotation des factures,
-- immuabilité de la source dun lead, et accès des rôles admin / owner /
-- branding.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
select plan(15);

-- ── Idempotence des webhooks ───────────────────────────────────────────────

insert into public.payment_events (provider, provider_event_id, type, payload)
values ('stripe', 'evt_test_idempotence', 'checkout.session.completed', '{}'::jsonb);

select throws_ok(
  $$insert into public.payment_events (provider, provider_event_id, type, payload)
    values ('stripe', 'evt_test_idempotence', 'checkout.session.completed', '{}'::jsonb)$$,
  '23505',
  null,
  'un événement Stripe rejoué est rejeté par la contrainte dunicité'
);

-- Le même identifiant chez lautre prestataire reste légitime : la clé est
-- (provider, provider_event_id), pas lidentifiant seul.
select lives_ok(
  $$insert into public.payment_events (provider, provider_event_id, type, payload)
    values ('paypal', 'evt_test_idempotence', 'PAYMENT.CAPTURE.COMPLETED', '{}'::jsonb)$$,
  'le même identifiant dévénement chez un autre prestataire reste accepté'
);

-- ── Facturation ────────────────────────────────────────────────────────────

select matches(
  (select numero from public.invoices limit 1),
  '^\d{4}-\d{6}$',
  'le numéro de facture est généré au format AAAA-NNNNNN'
);

insert into public.invoices (order_id) values ('d0000000-0000-0000-0000-00000000000b');

select is(
  (select count(distinct numero) from public.invoices)::int,
  (select count(*) from public.invoices)::int,
  'deux factures ne partagent jamais un numéro'
);

select throws_ok(
  $$delete from public.invoices where numero is not null$$,
  null,
  null,
  'une facture émise ne peut pas être supprimée'
);

-- ── Intégrité commerciale ──────────────────────────────────────────────────

select throws_ok(
  $$update public.leads set source = 'direct' where source = 'instagram'$$,
  null,
  null,
  'la source dun lead ne peut pas être réécrite après coup'
);

select throws_ok(
  $$insert into public.inscriptions (user_id, offre_id, cohorte_id)
    values ('66666666-6666-6666-6666-666666666666',
            'a0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-00000000000a')$$,
  '23505',
  null,
  'un client ne peut pas être inscrit deux fois à la même cohorte'
);

select throws_ok(
  $$insert into public.sessions (cohorte_id, titre, debut, fin)
    values ('c0000000-0000-0000-0000-00000000000a', 'Créneau incohérent',
            now(), now() - interval '1 hour')$$,
  '23514',
  null,
  'une session ne peut pas se terminer avant davoir commencé'
);

-- ── Rôle admin ─────────────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.inscriptions)::int, 2,
  'admin voit toutes les inscriptions, toutes cohortes confondues'
);

select is(
  (select count(*) from public.orders)::int, 2,
  'admin voit toutes les commandes'
);

select is(
  (select count(*) from public.audit_logs)::int, 0,
  'admin ne relit pas le journal daudit — sinon il peut vérifier que ses '
  'propres actions y sont, ce qui vide laudit de son sens'
);

-- ── Rôle owner ─────────────────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select cmp_ok(
  (select count(*) from public.audit_logs)::int, '>', 0,
  'owner relit le journal daudit'
);

-- ── Rôle branding ──────────────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

select is(
  (select count(*) from public.leads)::int, 0,
  'branding na aucun accès aux leads nominatifs'
);

select cmp_ok(
  (select count(*) from public.stats_conversion())::int, '>', 0,
  'branding obtient les statistiques de conversion par réseau, en agrégat'
);

set local request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';

select throws_ok(
  $$select * from public.stats_conversion()$$,
  '42501',
  null,
  'un client ne peut pas appeler la fonction de statistiques'
);

select * from finish();
rollback;
