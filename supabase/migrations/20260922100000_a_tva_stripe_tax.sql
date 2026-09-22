-- ═══════════════════════════════════════════════════════════════════════════
-- La TVA de chaque encaissement, calculée par Stripe Tax
--
-- Tranché le 22 septembre 2026 : pas de TVA européenne à facturer, et Stripe
-- Tax calcule ce qui est dû — la TVA émiratie pour un client établi aux
-- Émirats, rien pour les autres, **incluse dans le prix affiché**. Le client
-- paie donc toujours le prix annoncé ; ce qui change, c'est la ligne de TVA de
-- sa facture.
--
-- Trois ajouts, et pourquoi ils vivent ici :
--
-- - **`payments.tva_cents` et `payments.pays_client`**, par encaissement et non
--   par commande : un abonnement encaisse chaque mois sur la même commande, et
--   le client peut avoir déménagé entre deux prélèvements. `null` veut dire
--   « inconnu » — un encaissement d'avant Stripe Tax —, jamais « zéro » :
--   une facture ne doit pas affirmer une TVA nulle qu'on n'a pas calculée.
-- - **`invoices.payment_id`** : une facture de renouvellement ne pointait que
--   vers la commande, qu'elle partage avec toutes les autres. Sans ce lien, on
--   ne sait pas quel prélèvement elle facture, donc ni son montant exact ni sa
--   TVA.
-- - **`traiter_paiement()` et `renouveler_abonnement()` reçoivent la TVA et le
--   pays**, et les écrivent dans la même transaction que l'encaissement. Une
--   écriture après coup, depuis le webhook, laisserait une facture sans TVA le
--   jour où elle échoue — et une facture émise ne se corrige pas.
--
-- Seuls changements par rapport aux versions précédentes (20260917110000 et
-- 20260918100000) : les deux paramètres, les deux colonnes de `payments`, et
-- `payment_id` sur la facture.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.payments
  add column tva_cents   integer,
  add column pays_client text,
  add constraint payments_tva_bornee
    check (tva_cents is null or (tva_cents >= 0 and tva_cents <= montant_cents)),
  add constraint payments_pays_iso
    check (pays_client is null or pays_client ~ '^[A-Z]{2}$');

comment on column public.payments.tva_cents is
  'TVA incluse dans montant_cents, calculée par Stripe Tax. NULL = inconnue (encaissement '
  'antérieur à Stripe Tax), jamais une TVA nulle par défaut.';
comment on column public.payments.pays_client is
  'Pays retenu par Stripe Tax pour calculer la TVA (code ISO à deux lettres).';

alter table public.invoices
  add column payment_id uuid references public.payments (id) on delete restrict;

comment on column public.invoices.payment_id is
  'L''encaissement que la facture constate. Indispensable pour un abonnement, dont toutes '
  'les factures partagent la même commande. NULL pour les factures d''avant le 22 septembre '
  '2026 dont la commande porte plusieurs encaissements.';

create unique index invoices_payment_id_key
  on public.invoices (payment_id) where payment_id is not null;

-- Les factures existantes : rattachées quand leur commande n'a qu'un seul
-- encaissement, donc sans ambiguïté. Les autres restent sans lien plutôt que
-- d'en recevoir un deviné.
update public.invoices i
set payment_id = (select p.id from public.payments p where p.order_id = i.order_id)
where i.payment_id is null
  and (select count(*) from public.payments p where p.order_id = i.order_id) = 1;

-- ───────────────────────────────────────────────────────────────────────────
-- traiter_paiement() — la nouvelle signature remplace l'ancienne. La supprimer
-- d'abord : deux surcharges rendraient ambigu tout appel à douze arguments.
-- ───────────────────────────────────────────────────────────────────────────

drop function public.traiter_paiement(
  public.payment_provider, text, text, jsonb, uuid, uuid, integer, text, text, text, uuid, text
);

create function public.traiter_paiement(
  p_provider            public.payment_provider,
  p_event_id            text,
  p_event_type          text,
  p_payload             jsonb,
  p_user_id             uuid,
  p_formation_id        uuid,
  p_montant_cents       integer,
  p_devise              text,
  p_provider_order_id   text,
  p_provider_payment_id text,
  p_proposition_id      uuid default null,
  p_subscription_id     text default null,
  p_tva_cents           integer default null,
  p_pays_client         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_formation      public.formations%rowtype;
  v_order_id       uuid;
  v_payment_id     uuid;
  v_inscription_id uuid;
  v_fin_acces      date;
  v_lead_id        uuid;
  v_formateur_id   uuid;
begin
  -- ── Le garde d'idempotence, avant tout le reste ──────────────────────────
  insert into public.payment_events (provider, provider_event_id, type, payload, traite_at)
  values (p_provider, p_event_id, p_event_type, p_payload, now())
  on conflict (provider, provider_event_id) do nothing;

  if not found then
    return jsonb_build_object('deja_traite', true);
  end if;

  select * into v_formation from public.formations where id = p_formation_id;

  if not found then
    raise exception 'Formation % introuvable', p_formation_id;
  end if;

  -- ── La commande ──────────────────────────────────────────────────────────
  insert into public.orders (
    user_id, formation_id, montant_cents, devise, statut, provider, provider_order_id
  )
  values (
    p_user_id, p_formation_id, p_montant_cents, coalesce(p_devise, 'EUR'),
    'payee', p_provider, p_provider_order_id
  )
  on conflict (provider, provider_order_id)
    do update set statut = 'payee', updated_at = now()
  returning id into v_order_id;

  insert into public.payments (
    order_id, montant_cents, devise, statut, provider, provider_payment_id, paid_at,
    tva_cents, pays_client
  )
  values (
    v_order_id, p_montant_cents, coalesce(p_devise, 'EUR'),
    'reussi', p_provider, p_provider_payment_id, now(),
    p_tva_cents, upper(p_pays_client)
  )
  on conflict (provider, provider_payment_id) do nothing
  returning id into v_payment_id;

  -- ── L'accès ──────────────────────────────────────────────────────────────
  v_fin_acces := case v_formation.type_produit
    when 'accompagnement' then current_date + v_formation.duree_acces_jours
    when 'abonnement'     then current_date + 30
    else null                       -- formation : accès illimité
  end;

  insert into public.inscriptions (
    user_id, formation_id, statut, date_debut, date_fin_acces, order_id
  )
  values (p_user_id, p_formation_id, 'active', current_date, v_fin_acces, v_order_id)
  on conflict (user_id, formation_id) where statut = 'active'
    do update set
      date_fin_acces = case
        when inscriptions.date_fin_acces is null then null
        when v_formation.type_produit = 'accompagnement'
          then greatest(inscriptions.date_fin_acces, current_date) + v_formation.duree_acces_jours
        else excluded.date_fin_acces
      end,
      updated_at = now()
  returning id, date_fin_acces into v_inscription_id, v_fin_acces;

  -- ── L'abonnement, s'il y en a un ─────────────────────────────────────────
  if p_subscription_id is not null then
    insert into public.subscriptions (
      user_id, formation_id, inscription_id, provider, provider_subscription_id,
      statut, periode_fin
    )
    values (
      p_user_id, p_formation_id, v_inscription_id, p_provider, p_subscription_id,
      'active', (v_fin_acces)::timestamptz
    )
    on conflict (provider, provider_subscription_id)
      do update set statut = 'active', periode_fin = excluded.periode_fin, updated_at = now();
  end if;

  -- ── La facture, rattachée à son encaissement ─────────────────────────────
  insert into public.invoices (order_id, payment_id) values (v_order_id, v_payment_id)
  on conflict do nothing;

  -- ── L'accès Discord, par la file ─────────────────────────────────────────
  if v_formation.discord_role_id is not null then
    insert into public.discord_sync_queue (user_id, action, role_id)
    values (p_user_id, 'grant', v_formation.discord_role_id);
  else
    insert into public.automation_logs (declencheur, entite_type, entite_id, statut, details)
    values (
      'paiement.discord', 'inscriptions', v_inscription_id, 'echec',
      jsonb_build_object('raison', 'La formation ne déclare aucun rôle Discord')
    );
  end if;

  -- ── La proposition et le prospect ────────────────────────────────────────
  if p_proposition_id is not null then
    update public.propositions
    set statut = 'acceptee', order_id = v_order_id, updated_at = now()
    where id = p_proposition_id
    returning lead_id, formateur_id into v_lead_id, v_formateur_id;

    if v_formateur_id is not null and v_formation.type_produit <> 'abonnement' then
      update public.inscriptions
      set formateur_id = v_formateur_id
      where id = v_inscription_id and formateur_id is null;
    end if;

    if v_lead_id is not null then
      update public.leads set statut = 'gagne' where id = v_lead_id;
    end if;
  end if;

  insert into public.automation_logs (declencheur, entite_type, entite_id, statut, details)
  values (
    'paiement.traite', 'inscriptions', v_inscription_id, 'succes',
    jsonb_build_object('order_id', v_order_id, 'type_produit', v_formation.type_produit)
  );

  return jsonb_build_object(
    'deja_traite', false,
    'order_id', v_order_id,
    'inscription_id', v_inscription_id,
    'date_fin_acces', v_fin_acces
  );
end;
$$;

comment on function public.traiter_paiement is
  'Tout le traitement d''un paiement réussi, en une transaction : idempotence, commande, '
  'encaissement et sa TVA, inscription, abonnement, facture, rôle Discord, proposition et '
  'prospect, et le formateur de la proposition comme formateur de l''accès. '
  'Appelée par les handlers de webhook avec la clé de service.';

revoke all on function public.traiter_paiement(
  public.payment_provider, text, text, jsonb, uuid, uuid, integer, text, text, text, uuid, text,
  integer, text
) from public, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- renouveler_abonnement() — même opération.
-- ───────────────────────────────────────────────────────────────────────────

drop function public.renouveler_abonnement(
  public.payment_provider, text, text, jsonb, text, integer, text
);

create function public.renouveler_abonnement(
  p_provider            public.payment_provider,
  p_event_id            text,
  p_event_type          text,
  p_payload             jsonb,
  p_subscription_id     text,
  p_montant_cents       integer default null,
  p_provider_payment_id text default null,
  p_tva_cents           integer default null,
  p_pays_client         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_abo         public.subscriptions%rowtype;
  v_nouvelle    date;
  v_order       public.orders%rowtype;
  v_payment_id  uuid;
begin
  insert into public.payment_events (provider, provider_event_id, type, payload, traite_at)
  values (p_provider, p_event_id, p_event_type, p_payload, now())
  on conflict (provider, provider_event_id) do nothing;

  if not found then
    return jsonb_build_object('deja_traite', true);
  end if;

  select * into v_abo from public.subscriptions
  where provider = p_provider and provider_subscription_id = p_subscription_id;

  if not found then
    raise exception 'Abonnement % introuvable', p_subscription_id;
  end if;

  select greatest(coalesce(i.date_fin_acces, current_date), current_date) + 30
  into v_nouvelle
  from public.inscriptions i where i.id = v_abo.inscription_id;

  update public.inscriptions
  set date_fin_acces = v_nouvelle, statut = 'active', updated_at = now()
  where id = v_abo.inscription_id;

  update public.subscriptions
  set statut = 'active', periode_fin = v_nouvelle::timestamptz, updated_at = now()
  where id = v_abo.id;

  select o.* into v_order
  from public.inscriptions i
  join public.orders o on o.id = i.order_id
  where i.id = v_abo.inscription_id;

  if found and p_provider_payment_id is not null then
    insert into public.payments (
      order_id, montant_cents, devise, statut, provider, provider_payment_id, paid_at,
      tva_cents, pays_client
    )
    values (
      v_order.id, coalesce(p_montant_cents, v_order.montant_cents), v_order.devise,
      'reussi', p_provider, p_provider_payment_id, now(),
      p_tva_cents, upper(p_pays_client)
    )
    on conflict (provider, provider_payment_id) do nothing
    returning id into v_payment_id;

    if v_payment_id is not null then
      insert into public.invoices (order_id, payment_id) values (v_order.id, v_payment_id);
    end if;
  else
    insert into public.automation_logs (declencheur, entite_type, entite_id, statut, details)
    values (
      'stripe.renouvellement', 'subscriptions', v_abo.id, 'echec',
      jsonb_build_object(
        'raison', 'Encaissement non enregistré : commande d''origine ou référence absente',
        'reference', p_provider_payment_id,
        'montant_cents', p_montant_cents
      )
    );
  end if;

  return jsonb_build_object(
    'deja_traite', false, 'date_fin_acces', v_nouvelle, 'payment_id', v_payment_id
  );
end;
$$;

revoke all on function public.renouveler_abonnement(
  public.payment_provider, text, text, jsonb, text, integer, text, integer, text
) from public, anon, authenticated;
