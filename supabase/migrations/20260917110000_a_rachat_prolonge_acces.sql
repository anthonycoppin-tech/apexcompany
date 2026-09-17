-- ═══════════════════════════════════════════════════════════════════════════
-- Racheter un accompagnement en cours prolonge l'accès, il ne le raccourcit pas
--
-- Le conflit sur l'inscription active remplaçait la date de fin par
-- « aujourd'hui + durée ». Un client qui rachète trois mois alors qu'il lui en
-- reste vingt jours perdait ces vingt jours — payés deux fois, servis une.
-- La durée s'ajoute désormais à la date de fin actuelle.
--
-- Seul changement par rapport à 20260917100000 : la clause `on conflict` de
-- l'inscription.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.traiter_paiement(
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
  p_subscription_id     text default null
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
  -- Si la ligne existe déjà, l'événement a été traité : on sort sans rien
  -- faire. C'est ce qui empêche un webhook rejoué d'offrir un second accès.
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
  -- Elle peut déjà exister : l'ouverture du paiement la crée en `en_attente`.
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
    order_id, montant_cents, devise, statut, provider, provider_payment_id, paid_at
  )
  values (
    v_order_id, p_montant_cents, coalesce(p_devise, 'EUR'),
    'reussi', p_provider, p_provider_payment_id, now()
  )
  on conflict (provider, provider_payment_id) do nothing
  returning id into v_payment_id;

  -- ── L'accès ──────────────────────────────────────────────────────────────
  -- Une seule mécanique pour trois modèles économiques : une date, et `null`
  -- pour illimité. Le worker Discord lit cette date et n'a pas à savoir ce qui
  -- a été vendu.
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
      -- Un rachat d'accompagnement en cours prolonge l'accès depuis sa fin
      -- actuelle : repartir d'aujourd'hui ferait perdre au client les jours
      -- qu'il a déjà payés. Un accès illimité le reste.
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

  -- ── La facture ───────────────────────────────────────────────────────────
  -- Numérotation continue par trigger : obligation légale, et une facture émise
  -- ne peut plus être supprimée.
  insert into public.invoices (order_id) values (v_order_id)
  on conflict do nothing;

  -- ── L'accès Discord, par la file ─────────────────────────────────────────
  -- Jamais un appel direct depuis un handler de paiement : une coupure Discord
  -- ne doit pas faire perdre un accès client silencieusement.
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

    -- Le client est confié à celui qui l'a vendu, par défaut. Un abonnement
    -- communauté n'a pas de suivi individuel, et une affectation déjà posée —
    -- un renouvellement, un collègue désigné par l'équipe — n'est jamais écrasée.
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
  'encaissement, inscription, abonnement, facture, rôle Discord, proposition et prospect, '
  'et le formateur de la proposition comme formateur de l''accès. '
  'Appelée par les handlers de webhook avec la clé de service.';

-- Réservée au serveur : les handlers de webhook s'exécutent en `service_role`,
-- qui contourne la RLS. Aucun utilisateur de l'API n'a à pouvoir déclencher un
-- paiement traité — ce serait s'offrir un accès sans payer.
revoke all on function public.traiter_paiement(
  public.payment_provider, text, text, jsonb, uuid, uuid, integer, text, text, text, uuid, text
) from public, anon, authenticated;
