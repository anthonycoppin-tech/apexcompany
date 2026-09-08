-- ═══════════════════════════════════════════════════════════════════════════
-- La révocation automatique en fin d'accès
--
-- Le pendant exact de `traiter_paiement()` : l'argent qui entre ouvre une porte,
-- l'accès qui expire doit la refermer. Sans cette tâche, un abonnement résilié
-- garde son salon Discord indéfiniment, et personne ne s'en aperçoit — un
-- client satisfait ne signale pas qu'il a encore accès.
--
-- Deux règles portent tout le reste :
--
-- **`date_fin_acces is null` n'est jamais sélectionné.** C'est ce qui donne aux
-- formations leur accès illimité, sans cas particulier dans le code : la
-- requête ne les voit pas.
--
-- **On raisonne par inscription, jamais par personne.** Un client qui perd son
-- accompagnement mais garde son abonnement communauté ne doit perdre que le
-- rôle correspondant. C'est la raison du `not exists` plus bas, et c'est le
-- genre de détail dont l'absence ne se voit qu'en production, le jour où un
-- client fidèle se retrouve dehors.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.revoquer_acces_expires()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ligne     record;
  v_terminees integer := 0;
  v_revoques  integer := 0;
  v_gardes    integer := 0;
begin
  for v_ligne in
    select i.id, i.user_id, f.discord_role_id
    from public.inscriptions i
    join public.formations f on f.id = i.formation_id
    where i.statut = 'active'
      and i.date_fin_acces is not null
      and i.date_fin_acces < current_date
  loop
    update public.inscriptions
    set statut = 'terminee', updated_at = now()
    where id = v_ligne.id;

    v_terminees := v_terminees + 1;

    -- L'abonnement qui portait cette inscription s'arrête avec elle. Une
    -- résiliation demandée plus tôt a déjà posé son statut ; ici on ferme le
    -- cas où le prélèvement a simplement cessé.
    update public.subscriptions
    set statut = 'terminee', updated_at = now()
    where inscription_id = v_ligne.id and statut <> 'resiliee';

    continue when v_ligne.discord_role_id is null;

    -- Le passage en `terminee` ci-dessus a déjà sorti cette inscription du
    -- décompte : s'il reste une inscription active portant le même rôle, la
    -- personne y a droit par ailleurs et on ne lui retire rien.
    if exists (
      select 1
      from public.inscriptions i2
      join public.formations f2 on f2.id = i2.formation_id
      where i2.user_id = v_ligne.user_id
        and i2.statut = 'active'
        and f2.discord_role_id = v_ligne.discord_role_id
    ) then
      v_gardes := v_gardes + 1;
      continue;
    end if;

    -- Par la file, comme l'attribution. Une coupure Discord ne doit pas faire
    -- perdre la trace d'une révocation à faire.
    insert into public.discord_sync_queue (user_id, action, role_id)
    values (v_ligne.user_id, 'revoke', v_ligne.discord_role_id);

    v_revoques := v_revoques + 1;
  end loop;

  -- Une exécution qui ne trouve rien est une information : elle prouve que la
  -- tâche tourne. Un journal vide ne distingue pas « rien à faire » de « plus
  -- rien ne s'exécute depuis trois semaines ».
  insert into public.automation_logs (declencheur, statut, details)
  values (
    'revocation.quotidienne',
    'succes',
    jsonb_build_object(
      'inscriptions_terminees', v_terminees,
      'roles_revoques', v_revoques,
      'roles_conserves', v_gardes
    )
  );

  return jsonb_build_object(
    'inscriptions_terminees', v_terminees,
    'roles_revoques', v_revoques,
    'roles_conserves', v_gardes
  );
end;
$$;

comment on function public.revoquer_acces_expires is
  'Tâche quotidienne : passe en `terminee` les inscriptions dont la date de fin est dépassée '
  'et empile les révocations Discord correspondantes. Les inscriptions à date_fin_acces nulle '
  'ne sont jamais sélectionnées — c''est ce qui donne aux formations leur accès illimité. '
  'Raisonne par inscription, jamais par personne.';

-- Comme les fonctions de paiement : réservée au serveur. Un client qui pourrait
-- l'appeler ne se ferait pas de mal, mais rien ne justifie de l'exposer.
revoke all on function public.revoquer_acces_expires() from public, anon, authenticated;
