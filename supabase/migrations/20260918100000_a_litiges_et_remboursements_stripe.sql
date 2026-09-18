-- ═══════════════════════════════════════════════════════════════════════════
-- Ce que Stripe décide sans nous : litiges, et remboursements faits chez lui
--
-- Deux trous relevés le 18 septembre, tous deux du même genre — de l'argent
-- qui bouge chez le prestataire sans que la plateforme le sache :
--
-- 1. **Rien n'écrivait dans `disputes`.** La table existe depuis le
--    7 septembre, l'écran des litiges aussi, et le webhook ignorait
--    `charge.dispute.*`. Un litige a une date limite de réponse : passée sans
--    réponse, il est perdu d'office. Le découvrir dans le tableau de bord
--    Stripe trois semaines plus tard, c'est l'avoir déjà perdu.
-- 2. **Un remboursement fait dans le tableau de bord Stripe** laissait la
--    commande payée, l'inscription active et le rôle Discord en place. Le
--    back-office sait rembourser proprement ; rien n'empêche quelqu'un de le
--    faire depuis Stripe, par habitude ou en urgence.
--
-- Même principe que `traiter_paiement()` : le handler vérifie la signature et
-- fait **un** appel ; l'idempotence est `payment_events`, dans la même
-- transaction que le traitement.
--
-- **Le paiement se retrouve par une liste de références**, parce qu'il n'est
-- pas enregistré sous le même identifiant selon son origine : l'intention de
-- paiement pour un achat unique, la facture Stripe pour un abonnement. Le
-- handler rassemble les candidates, la base prend celle qu'elle connaît.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Les litiges ─────────────────────────────────────────────────────────────

create or replace function public.enregistrer_litige(
  p_provider             public.payment_provider,
  p_event_id             text,
  p_event_type           text,
  p_payload              jsonb,
  p_provider_dispute_id  text,
  p_references           text[],
  p_montant_cents        integer,
  p_statut               public.dispute_statut,
  p_motif                text default null,
  p_deadline             timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment_id  uuid;
  v_litige_id   uuid;
begin
  insert into public.payment_events (provider, provider_event_id, type, payload, traite_at)
  values (p_provider, p_event_id, p_event_type, p_payload, now())
  on conflict (provider, provider_event_id) do nothing;

  if not found then
    return jsonb_build_object('deja_traite', true);
  end if;

  select id into v_payment_id
  from public.payments
  where provider = p_provider and provider_payment_id = any (p_references)
  limit 1;

  -- Un litige sur un paiement inconnu : on le consigne et on acquitte.
  -- Rejouer ne fera pas apparaître le paiement, et la trace suffit à le
  -- traiter à la main depuis le tableau de bord du prestataire.
  if v_payment_id is null then
    insert into public.automation_logs (declencheur, entite_type, statut, details)
    values (
      'stripe.litige', 'disputes', 'ignore',
      jsonb_build_object(
        'event', p_event_id,
        'litige', p_provider_dispute_id,
        'raison', 'Paiement introuvable',
        'references', to_jsonb(p_references)
      )
    );
    return jsonb_build_object('deja_traite', false, 'paiement_introuvable', true);
  end if;

  -- Stripe ne garantit pas l'ordre de ses événements : un `updated` en retard
  -- ne doit pas rouvrir un litige déjà clos, ni ramener « preuves envoyées »
  -- à « ouvert ». L'état n'avance que vers l'avant.
  insert into public.disputes (
    payment_id, provider_dispute_id, montant_cents, statut, motif, deadline_reponse
  )
  values (v_payment_id, p_provider_dispute_id, p_montant_cents, p_statut, p_motif, p_deadline)
  on conflict (provider_dispute_id) do update
  set montant_cents = excluded.montant_cents,
      motif = coalesce(excluded.motif, disputes.motif),
      deadline_reponse = coalesce(excluded.deadline_reponse, disputes.deadline_reponse),
      statut = case
        when (case excluded.statut when 'ouvert' then 1 when 'preuves_envoyees' then 2 else 3 end)
          >= (case disputes.statut when 'ouvert' then 1 when 'preuves_envoyees' then 2 else 3 end)
        then excluded.statut
        else disputes.statut
      end,
      updated_at = now()
  returning id into v_litige_id;

  insert into public.automation_logs (declencheur, entite_type, entite_id, statut, details)
  values (
    'stripe.litige', 'disputes', v_litige_id, 'succes',
    jsonb_build_object('event', p_event_type, 'statut', p_statut, 'montant_cents', p_montant_cents)
  );

  -- **Aucun effet sur l'accès.** Un litige ouvert n'est pas perdu, et couper
  -- un client qui conteste par erreur (un débit qu'il ne reconnaît pas) ferme
  -- la porte à la résolution amiable. Un litige perdu, c'est de l'argent rendu
  -- de force : la décision de fermer l'accès reste humaine, depuis la fiche
  -- client, et le tableau de bord le signale.
  return jsonb_build_object('deja_traite', false, 'litige_id', v_litige_id);
end;
$$;

comment on function public.enregistrer_litige is
  'Crée ou fait avancer un litige reçu du prestataire, idempotent par payment_events. '
  'L''état n''avance que vers l''avant. Sans effet sur l''accès : la décision reste humaine.';

revoke all on function public.enregistrer_litige(
  public.payment_provider, text, text, jsonb, text, text[], integer, public.dispute_statut,
  text, timestamptz
) from public, anon, authenticated;

-- ── Les remboursements faits chez le prestataire ────────────────────────────

create or replace function public.enregistrer_remboursement_prestataire(
  p_provider            public.payment_provider,
  p_event_id            text,
  p_event_type          text,
  p_payload             jsonb,
  p_provider_refund_id  text,
  p_references          text[],
  p_montant_cents       integer,
  p_refund_id           uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment      public.payments%rowtype;
  v_deja_rendu   integer;
  v_refund_id    uuid;
begin
  insert into public.payment_events (provider, provider_event_id, type, payload, traite_at)
  values (p_provider, p_event_id, p_event_type, p_payload, now())
  on conflict (provider, provider_event_id) do nothing;

  if not found then
    return jsonb_build_object('deja_traite', true);
  end if;

  -- Déjà connu : c'est un remboursement lancé depuis le back-office, que
  -- `enregistrer_remboursement()` a déjà refermé. Le cas normal.
  if exists (select 1 from public.refunds where provider_refund_id = p_provider_refund_id) then
    return jsonb_build_object('deja_traite', false, 'deja_connu', true);
  end if;

  -- Lancé depuis le back-office, mais le webhook arrive avant que l'écran ait
  -- fini d'enregistrer. La ligne existe : on la referme ici, et l'écran
  -- trouvera `deja_traite` en relançant.
  if p_refund_id is not null and exists (select 1 from public.refunds where id = p_refund_id) then
    return public.enregistrer_remboursement(p_refund_id, p_provider_refund_id, null)
      || jsonb_build_object('origine', 'back-office');
  end if;

  -- Verrouillée pour le reste de la transaction : sans ça, deux remboursements
  -- partiels du même paiement annoncés en même temps liraient chacun la même
  -- somme déjà rendue, concluraient chacun « encore partiel », et le paiement
  -- se retrouverait intégralement remboursé chez Stripe sans que l'accès ne se
  -- referme jamais. Le second appel attend que le premier ait posé sa ligne
  -- dans `refunds` avant de recompter.
  select * into v_payment
  from public.payments
  where provider = p_provider and provider_payment_id = any (p_references)
  limit 1
  for update;

  if not found then
    insert into public.automation_logs (declencheur, entite_type, statut, details)
    values (
      'stripe.remboursement', 'refunds', 'ignore',
      jsonb_build_object(
        'event', p_event_id,
        'remboursement', p_provider_refund_id,
        'raison', 'Paiement introuvable',
        'references', to_jsonb(p_references)
      )
    );
    return jsonb_build_object('deja_traite', false, 'paiement_introuvable', true);
  end if;

  select coalesce(sum(montant_cents), 0) into v_deja_rendu
  from public.refunds
  where payment_id = v_payment.id and provider_refund_id is not null;

  insert into public.refunds (payment_id, montant_cents, motif, statut)
  values (
    v_payment.id, p_montant_cents,
    'Remboursé depuis le tableau de bord du prestataire', 'approuve'
  )
  returning id into v_refund_id;

  -- Remboursé en entier (en une ou plusieurs fois) : l'accès se referme, par
  -- la même fonction que depuis le back-office.
  if v_deja_rendu + p_montant_cents >= v_payment.montant_cents then
    return public.enregistrer_remboursement(v_refund_id, p_provider_refund_id, null)
      || jsonb_build_object('origine', 'prestataire', 'integral', true);
  end if;

  -- **Partiel : l'accès reste ouvert.** Un geste commercial de quelques euros
  -- n'est pas une annulation de la vente. C'est l'inverse du back-office, où
  -- « rembourser » veut dire mettre fin, et c'est voulu : ici personne n'a
  -- exprimé l'intention de fermer, on ne la devine pas.
  update public.refunds
  set statut = 'traite', provider_refund_id = p_provider_refund_id, traite_at = now()
  where id = v_refund_id;

  insert into public.automation_logs (declencheur, entite_type, entite_id, statut, details)
  values (
    'stripe.remboursement', 'refunds', v_refund_id, 'succes',
    jsonb_build_object(
      'montant_cents', p_montant_cents,
      'paiement_cents', v_payment.montant_cents,
      'acces_maintenu', true
    )
  );

  return jsonb_build_object(
    'deja_traite', false, 'origine', 'prestataire', 'integral', false, 'refund_id', v_refund_id
  );
end;
$$;

comment on function public.enregistrer_remboursement_prestataire is
  'Enregistre un remboursement annoncé par le webhook du prestataire. Reconnaît ceux du '
  'back-office, referme l''accès sur un remboursement intégral, le laisse ouvert sur un partiel.';

revoke all on function public.enregistrer_remboursement_prestataire(
  public.payment_provider, text, text, jsonb, text, text[], integer, uuid
) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Le renouvellement enregistre enfin ce qu'il encaisse
--
-- Relevé le même jour, en cherchant à quel paiement rattacher un litige sur un
-- mois d'abonnement : `renouveler_abonnement()` recevait le montant et la
-- référence du prélèvement, et n'en faisait rien. Seul le premier mois d'un
-- abonnement existait dans `payments`. Les renouvellements manquaient donc au
-- chiffre d'affaires, aux exports du comptable, à l'écran des transactions —
-- et un litige ou un remboursement sur l'un d'eux ne retrouvait aucun paiement.
--
-- Chaque prélèvement réussi donne désormais un encaissement **et une
-- facture**, rattachés à la commande d'origine : un paiement encaissé sans
-- facture émise n'est pas une option comptable.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.renouveler_abonnement(
  p_provider            public.payment_provider,
  p_event_id            text,
  p_event_type          text,
  p_payload             jsonb,
  p_subscription_id     text,
  p_montant_cents       integer default null,
  p_provider_payment_id text default null
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

  -- Le même garde que pour un premier paiement, et pour la même raison : un
  -- renouvellement rejoué ne doit pas offrir deux mois d'accès.
  if not found then
    return jsonb_build_object('deja_traite', true);
  end if;

  select * into v_abo from public.subscriptions
  where provider = p_provider and provider_subscription_id = p_subscription_id;

  if not found then
    raise exception 'Abonnement % introuvable', p_subscription_id;
  end if;

  -- Repoussée depuis la date de fin en cours, jamais depuis aujourd'hui : un
  -- prélèvement encaissé deux jours avant l'échéance ne doit pas raccourcir
  -- l'accès de deux jours.
  select greatest(coalesce(i.date_fin_acces, current_date), current_date) + 30
  into v_nouvelle
  from public.inscriptions i where i.id = v_abo.inscription_id;

  update public.inscriptions
  set date_fin_acces = v_nouvelle, statut = 'active', updated_at = now()
  where id = v_abo.inscription_id;

  update public.subscriptions
  set statut = 'active', periode_fin = v_nouvelle::timestamptz, updated_at = now()
  where id = v_abo.id;

  -- L'encaissement, sur la commande d'origine de l'abonnement.
  select o.* into v_order
  from public.inscriptions i
  join public.orders o on o.id = i.order_id
  where i.id = v_abo.inscription_id;

  if found and p_provider_payment_id is not null then
    insert into public.payments (
      order_id, montant_cents, devise, statut, provider, provider_payment_id, paid_at
    )
    values (
      v_order.id, coalesce(p_montant_cents, v_order.montant_cents), v_order.devise,
      'reussi', p_provider, p_provider_payment_id, now()
    )
    on conflict (provider, provider_payment_id) do nothing
    returning id into v_payment_id;

    if v_payment_id is not null then
      insert into public.invoices (order_id) values (v_order.id);
    end if;
  else
    -- Sans commande d'origine, l'accès est quand même prolongé — le client a
    -- payé — mais l'encaissement manque aux comptes : ça se signale.
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
  public.payment_provider, text, text, jsonb, text, integer, text
) from public, anon, authenticated;

comment on function public.renouveler_abonnement is
  'Repousse la date de fin d''accès d''un mois à chaque prélèvement réussi, et enregistre '
  'l''encaissement et sa facture sur la commande d''origine. La date part de la fin en cours.';
