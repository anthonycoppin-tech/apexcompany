-- ═══════════════════════════════════════════════════════════════════════════
-- L'exécution des remboursements
--
-- Jusqu'ici, un remboursement se faisait à la main dans le tableau de bord du
-- prestataire et la ligne se mettait à jour ensuite, ou pas. C'est de l'argent
-- qui sort sans trace côté plateforme, et un accès qui reste ouvert alors que
-- le client a été remboursé.
--
-- **Le rembourser deux fois est le seul risque qui compte ici.** Il se pare à
-- deux endroits, et les deux sont nécessaires :
--
-- 1. **Chez Stripe**, par une clé d'idempotence — c'est l'identifiant de la
--    ligne `refunds` qui sert de clé. Un appel rejoué renvoie le même
--    remboursement au lieu d'en créer un second, même si notre base n'a rien
--    enregistré entre-temps.
-- 2. **Ici**, par `provider_refund_id` : une fois posé, il prouve que
--    l'opération a abouti, et l'écran refuse de la relancer.
--
-- L'ordre compte : on appelle Stripe D'ABORD, on enregistre ENSUITE. Un appel
-- réseau ne peut pas tenir dans une transaction de base ; en revanche, grâce à
-- la clé d'idempotence, un échec d'enregistrement se rattrape en relançant —
-- Stripe renverra le même remboursement. L'inverse — enregistrer puis appeler —
-- laisserait une ligne « remboursée » sans argent rendu.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.refunds
  add column provider_refund_id text,
  add column erreur text;

comment on column public.refunds.provider_refund_id is
  'Identifiant du remboursement chez le prestataire. Sa présence prouve que l''opération a '
  'abouti : c''est ce qui empêche de rembourser deux fois. L''identifiant de la ligne sert de '
  'clé d''idempotence côté Stripe, ce qui rend un rejeu inoffensif.';

-- Partiel : plusieurs remboursements non encore exécutés coexistent, un même
-- identifiant de prestataire ne peut apparaître qu'une fois.
create unique index refunds_provider_refund_id_key
  on public.refunds (provider_refund_id)
  where provider_refund_id is not null;

create index refunds_a_traiter_idx on public.refunds (created_at)
  where statut in ('demande', 'approuve');

-- ═══════════════════════════════════════════════════════════════════════════
-- Ce qui suit l'encaissement inverse : l'accès se referme
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.enregistrer_remboursement(
  p_refund_id          uuid,
  p_provider_refund_id text,
  p_traite_par         uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund       public.refunds%rowtype;
  v_order_id     uuid;
  v_inscription  public.inscriptions%rowtype;
  v_role         text;
  v_revoque      boolean := false;
begin
  select * into v_refund from public.refunds where id = p_refund_id for update;

  if not found then
    raise exception 'Remboursement % introuvable', p_refund_id;
  end if;

  -- Déjà traité : on sort sans rien refaire. Le cas se produit quand un
  -- enregistrement a échoué après un appel réussi et qu'on relance.
  if v_refund.provider_refund_id is not null then
    return jsonb_build_object('deja_traite', true);
  end if;

  update public.refunds
  set statut = 'traite',
      provider_refund_id = p_provider_refund_id,
      traite_par = p_traite_par,
      traite_at = now(),
      erreur = null,
      updated_at = now()
  where id = p_refund_id;

  -- L'accès se referme avec le remboursement. Rembourser sans fermer, c'est
  -- offrir le produit ; c'est le genre d'oubli qui ne se voit jamais depuis
  -- l'intérieur, seulement dans les comptes.
  select o.id into v_order_id
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.id = v_refund.payment_id;

  if v_order_id is not null then
    update public.orders set statut = 'remboursee', updated_at = now() where id = v_order_id;

    select * into v_inscription
    from public.inscriptions
    where order_id = v_order_id and statut = 'active'
    limit 1;

    if found then
      update public.inscriptions
      set statut = 'remboursee', updated_at = now()
      where id = v_inscription.id;

      select discord_role_id into v_role
      from public.formations where id = v_inscription.formation_id;

      -- Même raisonnement que la révocation quotidienne : on retire le rôle
      -- seulement si aucune AUTRE inscription active du même client ne le
      -- porte. Un client remboursé d'un accompagnement ne doit pas perdre son
      -- abonnement communauté.
      if v_role is not null and not exists (
        select 1
        from public.inscriptions i2
        join public.formations f2 on f2.id = i2.formation_id
        where i2.user_id = v_inscription.user_id
          and i2.statut = 'active'
          and f2.discord_role_id = v_role
      ) then
        insert into public.discord_sync_queue (user_id, action, role_id)
        values (v_inscription.user_id, 'revoke', v_role);

        v_revoque := true;
      end if;
    end if;
  end if;

  insert into public.automation_logs (declencheur, entite_type, entite_id, statut, details)
  values (
    'remboursement.traite', 'refunds', p_refund_id, 'succes',
    jsonb_build_object(
      'montant_cents', v_refund.montant_cents,
      'order_id', v_order_id,
      'role_revoque', v_revoque
    )
  );

  return jsonb_build_object(
    'deja_traite', false,
    'order_id', v_order_id,
    'role_revoque', v_revoque
  );
end;
$$;

comment on function public.enregistrer_remboursement is
  'Enregistre un remboursement déjà exécuté chez le prestataire, et referme ce qui va avec : '
  'commande, inscription et rôle Discord. Appelée APRÈS l''appel au prestataire, jamais avant.';

-- Réservée au serveur, comme les autres fonctions d'argent.
revoke all on function public.enregistrer_remboursement(uuid, text, uuid)
  from public, anon, authenticated;
