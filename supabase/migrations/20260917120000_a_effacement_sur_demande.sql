-- ═══════════════════════════════════════════════════════════════════════════
-- Effacer une personne qui le demande
--
-- Toute personne peut demander l'effacement de ses données (RGPD, art. 17),
-- et la réponse est due sous un mois. Rien ne le permettait sans écrire du SQL
-- à la main sur la base de production — c'est-à-dire sans aucun garde-fou.
--
-- **Les règles sont celles de `purger_prospects_inactifs()`**, moins la durée :
-- - une trace d'argent (commande, inscription, abonnement) bloque tout. Les
--   pièces comptables se conservent dix ans, et l'effacement ne s'applique pas
--   à ce que la loi oblige à garder. Ce cas se traite avec le juriste ;
-- - un lead `gagne` bloque, pour la même raison ;
-- - un compte qui porte un rôle autre que `client` n'est jamais supprimé ici.
--
-- **Ce qu'elle efface** : le compte (et ce qui le suit en cascade : profil,
-- rôles, liaison Discord, file, propositions), tous les leads de la personne —
-- ceux du compte et ceux, sans compte, qui portent la même adresse —, leurs
-- historiques, leurs rendez-vous et comptes rendus, et ses consentements.
--
-- **Ce qu'elle garde** : une ligne d'audit par compte effacé, sans aucune
-- donnée personnelle, pour pouvoir répondre « oui, c'est fait, tel jour ».
--
-- Réservée au staff, vérifié dans la fonction : elle est `security definer`
-- et supprime dans `auth.users`, qu'aucune politique RLS ne protège.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.effacer_personne(
  p_lead_id    uuid,
  p_simulation boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lead          public.leads%rowtype;
  v_compte        uuid;
  v_leads         uuid[];
  v_rdv           uuid[];
  v_consentements uuid[];
  v_resultat      jsonb;
begin
  if not public.is_staff() then
    raise exception 'Réservé à l''équipe' using errcode = '42501';
  end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if not found then
    raise exception 'Prospect % introuvable', p_lead_id using errcode = 'P0002';
  end if;

  v_compte := coalesce(v_lead.user_id, v_lead.converti_user_id);

  -- Ce qui interdit l'effacement, dans l'ordre où on le dit ───────────────
  if v_compte is not null and exists (
    select 1 from public.user_roles r where r.user_id = v_compte and r.role <> 'client'
  ) then
    return jsonb_build_object('possible', false,
      'raison', 'Ce compte appartient à l''équipe : il ne se supprime pas d''ici.');
  end if;

  if v_lead.statut = 'gagne'
     or exists (select 1 from public.orders o
                where o.lead_id = p_lead_id or (v_compte is not null and o.user_id = v_compte))
     or (v_compte is not null and exists (select 1 from public.inscriptions i where i.user_id = v_compte))
     or (v_compte is not null and exists (select 1 from public.subscriptions s where s.user_id = v_compte))
  then
    return jsonb_build_object('possible', false,
      'raison', 'Cette personne a une trace d''achat. Les pièces comptables se conservent dix ans : '
                'l''effacement se traite avec le juriste, pas d''ici.');
  end if;

  -- Ce qui sera effacé ─────────────────────────────────────────────────────
  -- Tous les leads de la personne : ceux de son compte, et ceux sans compte
  -- qui portent la même adresse, s'ils ne sont eux-mêmes liés à aucun achat.
  select coalesce(array_agg(l.id), '{}')
  into v_leads
  from public.leads l
  where l.id = p_lead_id
     or (v_compte is not null and (l.user_id = v_compte or l.converti_user_id = v_compte))
     or (
       l.user_id is null
       and l.converti_user_id is null
       and lower(l.email) = lower(v_lead.email)
       and l.statut <> 'gagne'
       and not exists (select 1 from public.orders o where o.lead_id = l.id)
     );

  select coalesce(array_agg(a.id), '{}')
  into v_rdv
  from public.appointments a
  where a.lead_id = any (v_leads);

  -- Les consentements du compte, et ceux laissés sous cette adresse — sauf si
  -- un autre compte porte encore l'adresse.
  select coalesce(array_agg(c.id), '{}')
  into v_consentements
  from public.consents c
  where (v_compte is not null and c.user_id = v_compte)
     or (
       c.user_id is null
       and lower(c.email) = lower(v_lead.email)
       and not exists (
         select 1 from public.profiles p
         where lower(p.email) = lower(c.email) and p.id is distinct from v_compte
       )
     );

  v_resultat := jsonb_build_object(
    'possible', true,
    'simulation', p_simulation,
    'compte', v_compte is not null,
    'leads', cardinality(v_leads),
    'rendez_vous', cardinality(v_rdv),
    'consentements', cardinality(v_consentements)
  );

  if p_simulation then
    return v_resultat;
  end if;

  delete from public.appointments where id = any (v_rdv);
  delete from public.consents where id = any (v_consentements);
  -- `lead_events` part en cascade.
  delete from public.leads where id = any (v_leads);

  insert into public.audit_logs (user_id, action, table_cible, enregistrement_id, apres)
  values (
    auth.uid(), 'EFFACEMENT', coalesce(case when v_compte is not null then 'profiles' end, 'leads'),
    coalesce(v_compte, p_lead_id),
    jsonb_build_object('motif', 'demande de la personne', 'leads', cardinality(v_leads))
  );

  if v_compte is not null then
    -- `profiles`, `user_roles`, `discord_links`, `discord_sync_queue` et
    -- `propositions` suivent en cascade.
    delete from auth.users where id = v_compte;
  end if;

  insert into public.automation_logs (declencheur, statut, details)
  values ('rgpd.effacement', 'succes', v_resultat - 'simulation');

  return v_resultat;
end;
$$;

comment on function public.effacer_personne is
  'Efface, à sa demande, une personne sans trace d''achat : compte, leads, historique, rendez-vous '
  'et consentements. Refuse un client, un compte interne, ou quiconque a une commande. '
  'p_simulation = true (défaut) décrit sans rien supprimer. Réservée au staff.';

revoke all on function public.effacer_personne(uuid, boolean) from public, anon;
grant execute on function public.effacer_personne(uuid, boolean) to authenticated;
