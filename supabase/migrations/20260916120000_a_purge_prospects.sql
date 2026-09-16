-- ═══════════════════════════════════════════════════════════════════════════
-- La purge des prospects inactifs
--
-- Rien ne supprimait un prospect qui n'achète jamais : il restait en base
-- indéfiniment, avec ses réponses au formulaire, son téléphone et le compte
-- rendu de son audit. Durée tranchée le 16 septembre 2026, sur la
-- recommandation de la CNIL : **trois ans après le dernier contact venant du
-- prospect**, puis suppression.
--
-- Le tunnel inversé crée un compte au formulaire. Purger un prospect, c'est
-- donc supprimer un COMPTE, pas seulement une ligne de `leads` — et c'est là
-- que se joue tout le danger, parce que `inscriptions`, `propositions` et
-- `subscriptions` suivent le compte en cascade. D'où les règles, dans l'ordre
-- où elles comptent :
--
-- **Quiconque a une trace d'argent n'est pas un prospect.** Une commande, une
-- inscription ou un abonnement, quel que soit leur statut, suffit à sortir le
-- compte de la purge. Les pièces comptables ont leur propre durée légale, et
-- elle n'est pas de trois ans.
--
-- **Seul un compte `client` pur est candidat.** Un rôle de plus — formateur,
-- admin, owner, branding — et le compte n'est jamais touché, même inactif.
--
-- **Un lead `gagne` n'est jamais purgé**, même sans commande : c'est un client
-- dont l'achat vit ailleurs (données reprises de l'ancien site, typiquement).
--
-- **Le dernier contact est celui du prospect, pas le nôtre.** Une relance du
-- formateur ou une mise à jour du CRM ne prolonge pas la conservation : c'est
-- la personne qui doit s'être manifestée. On retient la plus récente de : la
-- création du compte ou du lead, une soumission du formulaire, une connexion,
-- un rendez-vous (pris ou tenu), un consentement donné ou retiré.
--
-- **Ce que la purge ne fait pas** : retirer le rôle `invité` sur Discord. La
-- file est rattachée au compte et part avec lui en cascade. Le rôle `invité` ne
-- donne accès qu'aux salons d'avant-achat ; la personne reste membre du serveur
-- comme n'importe quel visiteur. Si un jour cela doit changer, la révocation
-- s'empile AVANT la suppression, et le worker doit savoir traiter une ligne
-- dont le compte n'existe plus.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.purger_prospects_inactifs(p_simulation boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limite        timestamptz := now() - interval '3 years';
  v_comptes       uuid[];
  v_leads         uuid[];
  v_emails        text[];
  v_rdv           uuid[];
  v_consentements uuid[];
  v_resultat      jsonb;
begin
  -- Les comptes ─────────────────────────────────────────────────────────────
  select coalesce(array_agg(p.id), '{}')
  into v_comptes
  from public.profiles p
  join auth.users u on u.id = p.id
  where not exists (
      select 1 from public.user_roles r where r.user_id = p.id and r.role <> 'client'
    )
    and not exists (select 1 from public.orders o where o.user_id = p.id)
    and not exists (select 1 from public.inscriptions i where i.user_id = p.id)
    and not exists (select 1 from public.subscriptions s where s.user_id = p.id)
    and not exists (
      select 1 from public.leads l
      where (l.user_id = p.id or l.converti_user_id = p.id)
        and (l.statut = 'gagne'
             or exists (select 1 from public.orders o where o.lead_id = l.id))
    )
    -- `greatest` ignore les NULL : une personne qui ne s'est jamais connectée
    -- est jugée sur ses autres signes de vie.
    and greatest(
      p.created_at,
      u.last_sign_in_at,
      (select max(l.created_at) from public.leads l where l.user_id = p.id),
      (select max(e.created_at)
       from public.lead_events e
       join public.leads l on l.id = e.lead_id
       where l.user_id = p.id and e.type = 'formulaire_soumis'),
      (select max(greatest(a.created_at, a.debut))
       from public.appointments a
       join public.leads l on l.id = a.lead_id
       where l.user_id = p.id),
      (select max(c.created_at) from public.consents c where c.user_id = p.id)
    ) < v_limite;

  -- Les leads ───────────────────────────────────────────────────────────────
  -- Ceux des comptes retenus, plus les leads sans compte (repris d'avant le
  -- tunnel inversé, ou saisis à la main) qui remplissent les mêmes conditions.
  select coalesce(array_agg(l.id), '{}'), coalesce(array_agg(lower(l.email)), '{}')
  into v_leads, v_emails
  from public.leads l
  where l.user_id = any (v_comptes)
     or (
       l.user_id is null
       and l.converti_user_id is null
       and l.statut <> 'gagne'
       and not exists (select 1 from public.orders o where o.lead_id = l.id)
       and greatest(
         l.created_at,
         (select max(e.created_at) from public.lead_events e
          where e.lead_id = l.id and e.type = 'formulaire_soumis'),
         (select max(greatest(a.created_at, a.debut)) from public.appointments a
          where a.lead_id = l.id)
       ) < v_limite
     );

  -- Le compte rendu d'audit parle de la personne : `on delete set null` le
  -- garderait orphelin, donc on le supprime explicitement.
  select coalesce(array_agg(a.id), '{}')
  into v_rdv
  from public.appointments a
  where a.lead_id = any (v_leads);

  -- Un consentement prouve un traitement. Le traitement s'arrête ici, la preuve
  -- n'a plus d'objet. Par adresse email, seulement quand plus aucun compte ni
  -- lead ne la porte : la même adresse peut appartenir à un client.
  select coalesce(array_agg(c.id), '{}')
  into v_consentements
  from public.consents c
  where c.user_id = any (v_comptes)
     or (
       c.user_id is null
       and lower(c.email) = any (v_emails)
       and not exists (
         select 1 from public.profiles p
         where lower(p.email) = lower(c.email) and p.id <> all (v_comptes)
       )
       and not exists (
         select 1 from public.leads l
         where lower(l.email) = lower(c.email) and l.id <> all (v_leads)
       )
     );

  if not p_simulation then
    delete from public.appointments where id = any (v_rdv);
    delete from public.consents where id = any (v_consentements);

    -- `lead_events` part en cascade.
    delete from public.leads where id = any (v_leads);

    -- Une ligne par compte, sans aucune donnée personnelle : répondre un jour
    -- à « où est passé ce compte ? » sans conserver ce qu'on vient d'effacer.
    insert into public.audit_logs (action, table_cible, enregistrement_id, apres)
    select 'PURGE', 'profiles', id, jsonb_build_object('motif', 'prospect inactif depuis trois ans')
    from unnest(v_comptes) as id;

    -- `profiles`, `user_roles`, `discord_links`, `discord_sync_queue` et
    -- `propositions` suivent en cascade.
    delete from auth.users where id = any (v_comptes);
  end if;

  v_resultat := jsonb_build_object(
    'simulation', p_simulation,
    'comptes', cardinality(v_comptes),
    'leads', cardinality(v_leads),
    'rendez_vous', cardinality(v_rdv),
    'consentements', cardinality(v_consentements)
  );

  -- Même raison que la révocation : une exécution qui ne trouve rien prouve
  -- que la tâche tourne.
  insert into public.automation_logs (declencheur, statut, details)
  values ('purge.prospects', 'succes', v_resultat);

  return v_resultat;
end;
$$;

comment on function public.purger_prospects_inactifs is
  'Supprime les prospects sans contact de leur part depuis trois ans : compte, lead, rendez-vous '
  'et consentements. Ne touche jamais un compte qui porte une trace d''argent, un rôle autre que '
  'client, ou un lead gagné. p_simulation = true compte sans rien supprimer — à lancer avant le '
  'premier passage sur des données reprises.';

revoke all on function public.purger_prospects_inactifs(boolean) from public, anon, authenticated;
