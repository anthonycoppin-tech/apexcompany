-- ═══════════════════════════════════════════════════════════════════════════
-- Les garanties qui ne relèvent pas de la RLS mais qui coûtent aussi cher
-- quand elles cèdent : idempotence des webhooks, numérotation des factures,
-- immuabilité de la source dun lead, cohérence des types de produit, et accès
-- des rôles admin / owner / branding.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
select plan(32);

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

-- Vaut aussi pour le renouvellement dun abonnement : un événement rejoué ne
-- doit pas offrir deux mois daccès.
select throws_ok(
  $$insert into public.subscriptions (user_id, formation_id, provider, provider_subscription_id)
    values ('66666666-6666-6666-6666-666666666666',
            'a0000000-0000-0000-0000-000000000001',
            'stripe', 'sub_test_seed_b')$$,
  '23505',
  null,
  'un abonnement déjà enregistré chez le prestataire nest pas dupliqué'
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

-- Le filet contre le webhook rejoué, version révision 3 : lunicité porte sur
-- (user_id, formation_id), restreinte aux inscriptions ACTIVES.
select throws_ok(
  $$insert into public.inscriptions (user_id, formation_id, statut)
    values ('66666666-6666-6666-6666-666666666666',
            'a0000000-0000-0000-0000-000000000002',
            'active')$$,
  '23505',
  null,
  'un client ne peut pas avoir deux inscriptions actives à la même formation'
);

-- ... mais un accompagnement terminé doit pouvoir être racheté. Sans cette
-- restriction aux inscriptions actives, le filet censé protéger le client
-- lempêcherait de revenir.
select lives_ok(
  $$insert into public.inscriptions (user_id, formation_id, statut)
    values ('66666666-6666-6666-6666-666666666666',
            'a0000000-0000-0000-0000-000000000002',
            'terminee')$$,
  'une inscription terminée nempêche pas den reprendre une sur la même formation'
);

select throws_ok(
  $$insert into public.appointments (cal_booking_id, debut, fin)
    values ('cal_incoherent', now(), now() - interval '1 hour')$$,
  '23514',
  null,
  'un rendez-vous ne peut pas se terminer avant davoir commencé'
);

-- ── Cohérence des trois types de produit ───────────────────────────────────
-- Une seule mécanique daccès pour trois modèles économiques : seul
-- laccompagnement porte une durée, les deux autres ont date_fin_acces null
-- ou repoussée au prélèvement.

select throws_ok(
  $$insert into public.formations (slug, titre, prix_cents, type_produit, modalite, duree_acces_jours)
    values ('test-illimite-avec-duree', 'Test', 1000, 'formation', 'groupe', 30)$$,
  '23514',
  null,
  'une formation à accès illimité ne peut pas porter une durée daccès'
);

select throws_ok(
  $$insert into public.formations (slug, titre, prix_cents, type_produit, modalite, duree_acces_jours)
    values ('test-accompagnement-sans-duree', 'Test', 1000, 'accompagnement', 'individuel', null)$$,
  '23514',
  null,
  'un accompagnement doit déclarer sa durée daccès'
);

-- ── Le chemin de largent, rejoué ───────────────────────────────────────────
-- Le code le plus critique du projet. Un webhook rejoué ne doit ni créer deux
-- inscriptions, ni émettre deux factures, ni offrir deux mois daccès.

select is(
  (public.traiter_paiement(
    'stripe', 'evt_paiement_pgtap', 'checkout.session.completed', '{}'::jsonb,
    '66666666-6666-6666-6666-666666666666',
    'a0000000-0000-0000-0000-000000000003',
    99000, 'EUR', 'cs_pgtap', 'pi_pgtap', null, null
  ) ->> 'deja_traite')::boolean,
  false,
  'un premier paiement est traité'
);

select is(
  (select count(*) from public.inscriptions
   where user_id = '66666666-6666-6666-6666-666666666666'
     and formation_id = 'a0000000-0000-0000-0000-000000000003')::int,
  1,
  'le paiement ouvre exactement une inscription'
);

-- Une formation est à accès illimité : sans ce `null`, la révocation
-- quotidienne finirait par couper un accès vendu à vie.
select is(
  (select date_fin_acces from public.inscriptions
   where user_id = '66666666-6666-6666-6666-666666666666'
     and formation_id = 'a0000000-0000-0000-0000-000000000003'),
  null,
  'une formation ouvre un accès sans date de fin'
);

select is(
  (public.traiter_paiement(
    'stripe', 'evt_paiement_pgtap', 'checkout.session.completed', '{}'::jsonb,
    '66666666-6666-6666-6666-666666666666',
    'a0000000-0000-0000-0000-000000000003',
    99000, 'EUR', 'cs_pgtap', 'pi_pgtap', null, null
  ) ->> 'deja_traite')::boolean,
  true,
  'le même événement rejoué sort sans rien faire'
);

select is(
  (select count(*) from public.inscriptions
   where user_id = '66666666-6666-6666-6666-666666666666'
     and formation_id = 'a0000000-0000-0000-0000-000000000003')::int,
  1,
  'le rejeu na pas créé de deuxième inscription'
);

-- ── Rôle admin ─────────────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*) from public.inscriptions)::int, 4,
  'admin voit toutes les inscriptions, y compris celle ouverte par le paiement'
);

select is(
  (select count(*) from public.propositions)::int, 2,
  'admin voit les propositions des deux formateurs'
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

-- ── La révocation en fin daccès ───────────────────────────────────────────
-- Le pendant du paiement : largent qui entre ouvre une porte, laccès qui
-- expire doit la refermer. Placée en fin de fichier pour ne pas fausser les
-- décomptes des sections précédentes.

reset role;

-- Un produit qui partage le rôle Discord de « fondations ». Cest le cas qui
-- fait tomber une révocation raisonnée par personne plutôt que par inscription.
insert into public.formations (id, slug, titre, prix_cents, type_produit, modalite,
                               duree_acces_jours, discord_role_id, actif, ordre)
values ('a0000000-0000-0000-0000-000000000005', 'duo-test', 'Produit au rôle partagé',
        10000, 'accompagnement', 'individuel', 30, '900000000000000003', false, 9);

insert into public.inscriptions (user_id, formation_id, statut, date_debut, date_fin_acces)
values ('66666666-6666-6666-6666-666666666666',
        'a0000000-0000-0000-0000-000000000005',
        'active', current_date - 40, current_date - 1);

select is(
  (public.revoquer_acces_expires() ->> 'inscriptions_terminees')::int, 1,
  'la révocation termine linscription échue, et elle seule'
);

-- Le client garde « fondations », qui porte le même rôle : on ne lui retire
-- rien. Un client fidèle mis dehors parce quun autre accès expire est le genre
-- dincident quon découvre par un message furieux.
select is(
  (select count(*) from public.discord_sync_queue
   where action = 'revoke' and role_id = '900000000000000003')::int, 0,
  'le rôle détenu par une autre inscription active est conservé'
);

-- Linvariant central : une date de fin nulle nest jamais sélectionnée. Cest
-- ce qui donne aux formations leur accès à vie, sans cas particulier.
select is(
  (select statut::text from public.inscriptions
   where user_id = '66666666-6666-6666-6666-666666666666'
     and formation_id = 'a0000000-0000-0000-0000-000000000003'),
  'active',
  'un accès illimité nest jamais révoqué'
);

select is(
  (public.revoquer_acces_expires() ->> 'inscriptions_terminees')::int, 0,
  'un second passage ne retrouve rien à révoquer'
);

-- ── Le remboursement, rejoué ───────────────────────────────────────────────
-- De largent qui sort : le seul risque qui compte est de le faire deux fois.
-- `provider_refund_id` est ce qui prouve que lopération a abouti, et donc ce
-- qui empêche de la relancer.

insert into public.refunds (id, payment_id, montant_cents, motif, statut)
select '9a000000-0000-0000-0000-00000000000a', id, 50000, 'Test', 'approuve'
from public.payments where provider_payment_id = 'pi_test_seed_a';

select is(
  (public.enregistrer_remboursement(
    '9a000000-0000-0000-0000-00000000000a', 're_pgtap', null
  ) ->> 'deja_traite')::boolean,
  false,
  'un premier remboursement est enregistré'
);

-- Rembourser sans fermer laccès, cest offrir le produit.
select is(
  (select count(*) from public.inscriptions where statut = 'remboursee')::int, 1,
  'linscription correspondante passe en remboursee'
);

select is(
  (public.enregistrer_remboursement(
    '9a000000-0000-0000-0000-00000000000a', 're_pgtap', null
  ) ->> 'deja_traite')::boolean,
  true,
  'un remboursement rejoué sort sans rien faire'
);

select is(
  (select count(*) from public.inscriptions where statut = 'remboursee')::int, 1,
  'le rejeu na pas fermé un second accès'
);

select * from finish();
rollback;
