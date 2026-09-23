-- La périodicité d'un abonnement devient une propriété du produit.
--
-- APEX PRIME se vend **à 59 € par mois et à 490 € par an** (le document du
-- client, 23 septembre 2026). Le second était impossible : `+ 30` était écrit
-- en dur dans `traiter_paiement()` **et** dans `renouveler_abonnement()`, sans
-- branche conditionnelle, et `subscriptions` n'a aucune colonne de périodicité.
-- Un abonnement annuel aurait donné trente jours d'accès pour 490 €.
--
-- ── Pourquoi `duree_acces_jours` plutôt qu'une colonne de plus ──────────────
--
-- Parce que c'est déjà ce que la colonne veut dire. Pour un accompagnement,
-- c'est la durée d'accès ouverte par le paiement ; pour un abonnement, c'est
-- exactement la même chose — la durée ouverte par chaque prélèvement. Les deux
-- branches du calcul d'accès disaient déjà la même phrase avec deux
-- expressions différentes, et elles fusionnent ici en une seule.
--
-- Une colonne `periodicite_jours` séparée aurait créé le cas « les deux sont
-- renseignées et se contredisent », qui n'a pas de bonne réponse.
--
-- ── Ce que la contrainte dit maintenant ─────────────────────────────────────
--
-- `abonnement` **exige** la durée, comme `accompagnement`. `formation` continue
-- de l'interdire : elle donne un accès illimité, et une durée sur une formation
-- serait une promesse que rien ne tient.
--
-- L'exigence n'est pas cosmétique : sans elle, un abonnement sans durée ferait
-- rendre `null` à l'arithmétique de dates, et `null` dans `date_fin_acces`
-- signifie **accès illimité**. Un oubli de saisie offrirait le produit à vie.

-- **L'ordre compte, et il n'est pas celui qu'on écrit spontanément.** Renseigner
-- la durée avant de retirer l'ancienne contrainte échoue : celle-ci interdit
-- précisément une durée sur un abonnement. On retire, on renseigne, on repose.
alter table public.formations
  drop constraint formations_duree_acces_coherente;

-- Les abonnements existants étaient mensuels par construction.
update public.formations
   set duree_acces_jours = 30
 where type_produit = 'abonnement'
   and duree_acces_jours is null;

alter table public.formations
  add constraint formations_duree_acces_coherente check (
    (type_produit in ('accompagnement', 'abonnement')
       and duree_acces_jours is not null and duree_acces_jours > 0)
    or (type_produit = 'formation' and duree_acces_jours is null)
  );

comment on column public.formations.duree_acces_jours is
  'Durée d''accès ouverte par un paiement, en jours. Pour un accompagnement : la durée totale '
  '(30 / 60 / 90 / 180). Pour un abonnement : la période de facturation, donc la durée que '
  'chaque prélèvement repousse (30 pour du mensuel, 365 pour de l''annuel). Nulle et interdite '
  'pour une formation, dont l''accès est illimité.';

-- ───────────────────────────────────────────────────────────────────────────
-- traiter_paiement() — les deux branches d'accès n'en font plus qu'une.
-- ───────────────────────────────────────────────────────────────────────────

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
  -- Une seule expression depuis le 23 septembre : la durée vient du produit,
  -- que ce soit un accompagnement de trois mois ou un abonnement annuel. Une
  -- formation n'en déclare aucune et reçoit un accès illimité.
  v_fin_acces := case
    when v_formation.duree_acces_jours is not null
      then current_date + v_formation.duree_acces_jours
    else null
  end;

  insert into public.inscriptions (
    user_id, formation_id, statut, date_debut, date_fin_acces, order_id
  )
  values (p_user_id, p_formation_id, 'active', current_date, v_fin_acces, v_order_id)
  on conflict (user_id, formation_id) where statut = 'active'
    do update set
      date_fin_acces = case
        when inscriptions.date_fin_acces is null then null
        -- Le cumul reste réservé à l'accompagnement : c'est un rachat, qui
        -- prolonge. Un abonnement, lui, se renouvelle — et `acces-existant.ts`
        -- refuse d'en ouvrir un second tant que le premier court.
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

-- ───────────────────────────────────────────────────────────────────────────
-- renouveler_abonnement() — repousse de la période du produit, plus de 30.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.renouveler_abonnement(
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
  v_periode     integer;
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

  select f.duree_acces_jours into v_periode
  from public.formations f where f.id = v_abo.formation_id;

  -- **On échoue plutôt que de supposer.** La contrainte garantit qu'un
  -- abonnement déclare sa période ; si on arrive ici sans elle, l'arithmétique
  -- de dates rendrait `null`, et `date_fin_acces` à `null` veut dire **accès
  -- illimité**. Un produit mal saisi offrirait le programme à vie, en silence.
  -- Une exception fait répondre 500 au webhook, donc rejouer le prestataire,
  -- donc apparaître l'incident.
  if v_periode is null then
    raise exception 'Abonnement % : le produit ne déclare aucune périodicité', p_subscription_id;
  end if;

  select greatest(coalesce(i.date_fin_acces, current_date), current_date) + v_periode
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
      'paiement.renouvellement', 'subscriptions', v_abo.id, 'echec',
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

comment on function public.renouveler_abonnement is
  'Un prélèvement d''abonnement : repousse la date de fin d''accès de la période déclarée par '
  'le produit (`formations.duree_acces_jours`), enregistre l''encaissement et sa TVA, et émet '
  'la facture. Lève une exception si le produit ne déclare aucune période — un `null` y '
  'signifierait un accès illimité.';

-- ── APEX PRIME annuel ───────────────────────────────────────────────────────
-- Le produit qui a motivé tout ce qui précède. 490 € par an, environ 30 % de
-- remise sur douze mensualités à 59 €.
--
-- En brouillon comme les huit autres : la base refuse un produit publié sans
-- rôle Discord. Il partagera vraisemblablement celui du mensuel — c'est le même
-- accès, payé autrement — mais ça se décide en saisissant le rôle, pas ici.
insert into public.formations (
  slug, titre, description, prix_cents, type_produit, modalite,
  duree_acces_jours, whop_plan_id, actif, ordre
) values (
  'apex-prime-annuel', 'APEX PRIME — annuel',
  'Le même accès qu''APEX PRIME, payé une fois par an. Environ 30 % de remise sur l''année.',
  49000, 'abonnement', 'groupe', 365, 'plan_SSkdKF0cmGFrF', false, 9
)
on conflict (slug) do nothing;
