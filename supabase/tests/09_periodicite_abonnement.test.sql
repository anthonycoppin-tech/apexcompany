-- ═══════════════════════════════════════════════════════════════════════════
-- La périodicité d'un abonnement
--
-- APEX PRIME se vend au mois (59 €) et à l'année (490 €). Avant le
-- 23 septembre 2026, `+ 30` était écrit en dur dans `traiter_paiement()` ET
-- dans `renouveler_abonnement()`, sans branche conditionnelle : un abonnement
-- annuel aurait ouvert trente jours d'accès pour 490 €.
--
-- Ces tests existent pour qu'un remaniement ne réintroduise pas la constante
-- en silence. `scripts/verifier-schema.mjs` rejoue les mêmes vérifications sur
-- PGlite.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
select plan(6);

-- ── La contrainte ───────────────────────────────────────────────────────────
--
-- Le `null` n'est pas une donnée manquante anodine : `date_fin_acces` à `null`
-- signifie **accès illimité**. Un abonnement sans période offrirait donc le
-- produit à vie, sans que rien ne le signale.

select throws_ok(
  $$insert into public.formations
      (slug, titre, prix_cents, type_produit, modalite, duree_acces_jours, actif, ordre)
    values ('sans-periode', 'Sans période', 1000, 'abonnement', 'groupe', null, false, 90)$$,
  '23514',
  null,
  'un abonnement sans période est refusé — un null y vaudrait accès illimité'
);

select throws_ok(
  $$insert into public.formations
      (slug, titre, prix_cents, type_produit, modalite, duree_acces_jours, actif, ordre)
    values ('formation-datee', 'Formation datée', 1000, 'formation', 'groupe', 30, false, 91)$$,
  '23514',
  null,
  'une formation avec une période est refusée — son accès est illimité par définition'
);

select lives_ok(
  $$insert into public.formations
      (id, slug, titre, prix_cents, type_produit, modalite, duree_acces_jours,
       discord_role_id, actif, ordre)
    values ('a0000000-0000-0000-0000-000000000009', 'annuel-test', 'Abonnement annuel',
            49000, 'abonnement', 'groupe', 365, '900000000000000009', true, 92)$$,
  'un abonnement annuel est accepté'
);

-- ── Le premier paiement ─────────────────────────────────────────────────────

select public.traiter_paiement(
  'whop', 'evt_annuel_1', 'payment.succeeded', '{}'::jsonb,
  '66666666-6666-6666-6666-666666666666', 'a0000000-0000-0000-0000-000000000009',
  49000, 'EUR', 'ord_annuel_1', 'pay_annuel_1', null, 'mem_annuel_1'
);

select is(
  (select date_fin_acces from public.inscriptions
    where formation_id = 'a0000000-0000-0000-0000-000000000009' and statut = 'active'),
  current_date + 365,
  'un abonnement annuel ouvre 365 jours d''accès, pas 30'
);

-- ── Le renouvellement ───────────────────────────────────────────────────────

select is(
  (public.renouveler_abonnement(
    'whop', 'evt_annuel_2', 'payment.succeeded', '{}'::jsonb, 'mem_annuel_1',
    49000, 'pay_annuel_2'
  ) ->> 'date_fin_acces')::date,
  current_date + 730,
  'son renouvellement repousse d''une année, pas d''un mois'
);

-- ── Le mensuel n'a pas changé de comportement ───────────────────────────────
--
-- Le seed porte « Communauté », un abonnement mensuel. Il doit continuer à se
-- renouveler de trente jours : la période vient désormais du produit, et celui
-- de ce produit vaut bien 30.

-- L'échéance est relevée AVANT l'appel, et rangée : la comparer dans la même
-- instruction que le renouvellement reviendrait à lire une valeur que cet
-- appel est justement en train de modifier, sans que l'ordre d'évaluation des
-- deux arguments soit garanti.
create temporary table echeance_avant as
select greatest(coalesce(i.date_fin_acces, current_date), current_date) as fin
  from public.subscriptions s
  join public.inscriptions i on i.id = s.inscription_id
 where s.provider_subscription_id = 'sub_test_seed_b';

select is(
  (public.renouveler_abonnement(
    'stripe', 'evt_mensuel_1', 'invoice.paid', '{}'::jsonb, 'sub_test_seed_b',
    4900, 'in_mensuel_1'
  ) ->> 'date_fin_acces')::date,
  (select fin from echeance_avant) + 30,
  'un abonnement mensuel continue de se renouveler de trente jours'
);

select * from finish();
rollback;
