-- ═══════════════════════════════════════════════════════════════════════════
-- Politiques RLS
--
-- Règle de lecture de ce fichier : chaque table a une section, et toute table
-- du schéma public y figure. Une table absente est une table inaccessible —
-- ce qui est le bon défaut, mais doit être un choix, pas un oubli. Les seules
-- tables volontairement sans politique sont signalées comme telles.
--
-- Deux invariants que le reste du fichier ne fait que décliner :
--   1. Un coach ne voit jamais les données financières dun client.
--   2. Un coach ne voit jamais les clients dun autre coach.
-- ═══════════════════════════════════════════════════════════════════════════

-- Helpers de rattachement client ────────────────────────────────────────────

create or replace function public.est_inscrit_cohorte(c uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.inscriptions
    where cohorte_id = c
      and user_id = auth.uid()
      and statut in ('active', 'terminee')
  );
$$;

create or replace function public.est_inscrit_session(s uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.sessions ses
    join public.inscriptions ins on ins.cohorte_id = ses.cohorte_id
    where ses.id = s
      and ins.user_id = auth.uid()
      and ins.statut in ('active', 'terminee')
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- profiles
-- ═══════════════════════════════════════════════════════════════════════════

create policy profiles_lit_le_sien on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_modifie_le_sien on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_staff_lit_tout on public.profiles
  for select to authenticated
  using (public.is_staff());

create policy profiles_staff_ecrit on public.profiles
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Un coach a besoin du nom de ses apprenants, et daucun autre.
create policy profiles_coach_lit_sa_cohorte on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.inscriptions ins
      join public.cohorte_coachs cc on cc.cohorte_id = ins.cohorte_id
      where ins.user_id = public.profiles.id
        and cc.coach_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- user_roles — seul un owner attribue les rôles
-- ═══════════════════════════════════════════════════════════════════════════

create policy user_roles_lit_les_siens on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());

create policy user_roles_staff_lit on public.user_roles
  for select to authenticated
  using (public.is_staff());

create policy user_roles_owner_ecrit on public.user_roles
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- ═══════════════════════════════════════════════════════════════════════════
-- leads, lead_events, appointments — commercial, fermé aux coachs
-- ═══════════════════════════════════════════════════════════════════════════

create policy leads_staff on public.leads
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- lead_events : lecture et insertion, jamais UPDATE ni DELETE.
-- Absence de politique découriture = journal réellement immuable.
create policy lead_events_staff_lit on public.lead_events
  for select to authenticated
  using (public.is_staff());

create policy lead_events_staff_insere on public.lead_events
  for insert to authenticated
  with check (public.is_staff());

create policy appointments_staff on public.appointments
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ═══════════════════════════════════════════════════════════════════════════
-- offres — le catalogue actif est public
-- ═══════════════════════════════════════════════════════════════════════════

create policy offres_publiques_en_lecture on public.offres
  for select to anon, authenticated
  using (actif);

create policy offres_interne_lit_tout on public.offres
  for select to authenticated
  using (public.is_staff() or public.has_role('coach') or public.has_role('branding'));

create policy offres_staff_ecrit on public.offres
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ═══════════════════════════════════════════════════════════════════════════
-- cohortes, cohorte_coachs
-- ═══════════════════════════════════════════════════════════════════════════

create policy cohortes_staff on public.cohortes
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy cohortes_coach_lit_les_siennes on public.cohortes
  for select to authenticated
  using (public.coach_de_cohorte(id));

create policy cohortes_client_lit_la_sienne on public.cohortes
  for select to authenticated
  using (public.est_inscrit_cohorte(id));

create policy cohorte_coachs_staff on public.cohorte_coachs
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy cohorte_coachs_coach_lit on public.cohorte_coachs
  for select to authenticated
  using (coach_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- inscriptions — Politiques 1 et 2 du document de conception
-- ═══════════════════════════════════════════════════════════════════════════

-- Politique 1 : le client voit ses données.
create policy inscriptions_client_lit_les_siennes on public.inscriptions
  for select to authenticated
  using (user_id = auth.uid());

-- Politique 2 : le coach voit sa cohorte, et rien dautre.
-- Noter labsence du client ici : il passe par la politique 1. Ajouter une
-- condition client à cette politique-ci reviendrait à ouvrir la lecture des
-- inscriptions des autres.
create policy inscriptions_coach_lit_sa_cohorte on public.inscriptions
  for select to authenticated
  using (public.coach_de_cohorte(cohorte_id) or public.is_staff());

create policy inscriptions_staff_ecrit on public.inscriptions
  for insert to authenticated with check (public.is_staff());

create policy inscriptions_staff_modifie on public.inscriptions
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy inscriptions_staff_supprime on public.inscriptions
  for delete to authenticated
  using (public.is_staff());

-- ═══════════════════════════════════════════════════════════════════════════
-- sessions, presences
-- ═══════════════════════════════════════════════════════════════════════════

create policy sessions_staff on public.sessions
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy sessions_coach_lit on public.sessions
  for select to authenticated
  using (public.coach_de_cohorte(cohorte_id));

create policy sessions_coach_modifie on public.sessions
  for update to authenticated
  using (public.coach_de_cohorte(cohorte_id))
  with check (public.coach_de_cohorte(cohorte_id));

create policy sessions_client_lit_son_planning on public.sessions
  for select to authenticated
  using (public.est_inscrit_cohorte(cohorte_id));

create policy presences_staff on public.presences
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Lémargement est le travail du coach : lecture et écriture sur ses sessions.
create policy presences_coach on public.presences
  for all to authenticated
  using (public.coach_de_session(session_id))
  with check (public.coach_de_session(session_id));

create policy presences_client_lit_les_siennes on public.presences
  for select to authenticated
  using (public.est_mon_inscription(inscription_id));

-- ═══════════════════════════════════════════════════════════════════════════
-- replays
--
-- La RLS décide qui voit la LIGNE. Elle ne protège pas la vidéo : la ligne ne
-- contient quun identifiant dasset. La protection réelle est la signature
-- dURL côté serveur, qui revérifie ces mêmes conditions avant démettre un
-- jeton de courte durée.
-- ═══════════════════════════════════════════════════════════════════════════

create policy replays_staff on public.replays
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy replays_coach on public.replays
  for all to authenticated
  using (public.coach_de_session(session_id))
  with check (public.coach_de_session(session_id));

create policy replays_client_lit on public.replays
  for select to authenticated
  using (
    publie
    and (disponible_jusqu_au is null or disponible_jusqu_au > now())
    and public.est_inscrit_session(session_id)
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- suivi_notes — le cloisonnement interne / client
-- ═══════════════════════════════════════════════════════════════════════════

create policy suivi_notes_staff on public.suivi_notes
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy suivi_notes_coach on public.suivi_notes
  for all to authenticated
  using (public.coach_de_inscription(inscription_id))
  with check (public.coach_de_inscription(inscription_id) and coach_id = auth.uid());

-- Lecture seule, et uniquement ce qui a été explicitement rendu visible.
create policy suivi_notes_client_lit_les_visibles on public.suivi_notes
  for select to authenticated
  using (visible_client and public.est_mon_inscription(inscription_id));

-- ═══════════════════════════════════════════════════════════════════════════
-- coaching_sessions
-- ═══════════════════════════════════════════════════════════════════════════

create policy coaching_staff on public.coaching_sessions
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy coaching_coach on public.coaching_sessions
  for all to authenticated
  using (coach_id = auth.uid() or public.coach_de_inscription(inscription_id))
  with check (coach_id = auth.uid() or public.coach_de_inscription(inscription_id));

create policy coaching_client_lit on public.coaching_sessions
  for select to authenticated
  using (public.est_mon_inscription(inscription_id));

-- ═══════════════════════════════════════════════════════════════════════════
-- Argent — Politique 3 : fermé aux coachs, sans exception.
--
-- Le client lit ses propres lignes. Le coach napparaît nulle part ci-dessous ;
-- cest le seul endroit du fichier où cette absence est le point principal.
-- ═══════════════════════════════════════════════════════════════════════════

create policy orders_staff on public.orders
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy orders_client_lit_les_siennes on public.orders
  for select to authenticated
  using (user_id = auth.uid());

create policy payments_staff on public.payments
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy payments_client_lit_les_siens on public.payments
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = public.payments.order_id and o.user_id = auth.uid()
    )
  );

create policy payment_schedules_staff on public.payment_schedules
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Le client doit voir ses échéances à venir : cest la première cause dappel
-- au support quand elle est cachée.
create policy payment_schedules_client_lit on public.payment_schedules
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = public.payment_schedules.order_id and o.user_id = auth.uid()
    )
  );

create policy invoices_staff on public.invoices
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy invoices_client_lit_les_siennes on public.invoices
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = public.invoices.order_id and o.user_id = auth.uid()
    )
  );

create policy refunds_staff on public.refunds
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy refunds_client_lit_les_siens on public.refunds
  for select to authenticated
  using (
    exists (
      select 1
      from public.payments p
      join public.orders o on o.id = p.order_id
      where p.id = public.refunds.payment_id and o.user_id = auth.uid()
    )
  );

-- Les litiges sont une affaire entre la société et le prestataire. Le client
-- na pas à lire létat de la procédure le concernant.
create policy disputes_staff on public.disputes
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ═══════════════════════════════════════════════════════════════════════════
-- payment_events — AUCUNE POLITIQUE, VOLONTAIREMENT.
--
-- Cette table nest écrite que par les handlers de webhook, qui sexécutent
-- avec la clé service_role et contournent donc la RLS. Aucun utilisateur, pas
-- même un owner, ne doit pouvoir y écrire depuis lАPI : une ligne insérée à la
-- main ici fait passer un vrai événement pour déjà traité, et le paiement
-- correspondant nest jamais honoré. La consultation se fait côté serveur, par
-- /admin/logs.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- Discord
-- ═══════════════════════════════════════════════════════════════════════════

create policy discord_links_lit_le_sien on public.discord_links
  for select to authenticated
  using (user_id = auth.uid());

create policy discord_links_staff on public.discord_links
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- La file est consommée par le worker en service_role. Le staff la lit pour
-- diagnostiquer, personne ne lécrit depuis lAPI.
create policy discord_sync_queue_staff_lit on public.discord_sync_queue
  for select to authenticated
  using (public.is_staff());

-- ═══════════════════════════════════════════════════════════════════════════
-- Traçabilité
-- ═══════════════════════════════════════════════════════════════════════════

create policy automation_logs_staff_lit on public.automation_logs
  for select to authenticated
  using (public.is_staff());

-- Le journal daudit est réservé à owner : un admin qui peut relire — et à plus
-- forte raison effacer — la trace de ses propres actions rend laudit inutile.
create policy audit_logs_owner_lit on public.audit_logs
  for select to authenticated
  using (public.is_owner());

create policy consents_lit_les_siens on public.consents
  for select to authenticated
  using (user_id = auth.uid());

create policy consents_staff_lit on public.consents
  for select to authenticated
  using (public.is_staff());

-- Un visiteur non authentifié accepte les CGV avant davoir un compte.
create policy consents_insertion_ouverte on public.consents
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- Statistiques de conversion pour le pôle branding
--
-- Le besoin est « savoir quel réseau convertit ». Il se satisfait dagrégats.
-- Une fonction SECURITY DEFINER qui vérifie le rôle et ne renvoie que des
-- compteurs vaut mieux quun accès en lecture à la table leads : le pôle
-- branding na aucune raison de voir un nom, un email ou un téléphone.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.stats_conversion(
  depuis date default (current_date - interval '90 days')::date
)
returns table (
  source         public.lead_source,
  leads          bigint,
  rdv            bigint,
  gagnes         bigint,
  taux_conversion numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_staff() or public.has_role('branding')) then
    raise exception 'Accès refusé' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    l.source,
    count(*) as leads,
    count(*) filter (where l.statut in ('rdv', 'proposition', 'gagne')) as rdv,
    count(*) filter (where l.statut = 'gagne') as gagnes,
    round(
      100.0 * count(*) filter (where l.statut = 'gagne') / nullif(count(*), 0),
      2
    ) as taux_conversion
  from public.leads l
  where l.created_at >= depuis
  group by l.source
  order by gagnes desc;
end;
$$;

revoke all on function public.stats_conversion(date) from public, anon;
grant execute on function public.stats_conversion(date) to authenticated;
