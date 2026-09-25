-- ═══════════════════════════════════════════════════════════════════════════
-- Retrait du rôle `branding` — 25 septembre 2026
--
-- Décidé par Anthony après la présentation au client : personne ne tient ce
-- rôle chez le client, et la conversion par réseau se lit dans le back-office
-- (`/admin/reseaux`). Le rôle disparaît du produit.
--
-- **La valeur reste dans l'énumération `app_role`, et c'est voulu.**
-- PostgreSQL ne sait pas retirer une valeur d'énumération : il faudrait
-- recréer le type, donc supprimer et recréer `has_role()` et toutes les
-- politiques qui en dépendent — une réécriture de la sécurité entière pour
-- enlever un mot. Même parti que `stripe` et `paypal` dans `payment_provider` :
-- une valeur inerte, que **plus rien ne peut écrire** grâce à la contrainte
-- ci-dessous, et que plus aucune politique ne lit.
-- ═══════════════════════════════════════════════════════════════════════════

delete from public.user_roles where role = 'branding';

alter table public.user_roles
  add constraint user_roles_sans_branding check (role <> 'branding');

comment on constraint user_roles_sans_branding on public.user_roles is
  'Le rôle branding a été retiré le 25 septembre 2026. La valeur reste dans l''énumération '
  '(PostgreSQL ne sait pas la retirer sans recréer le type), mais ne peut plus être attribuée.';

-- Le catalogue complet, brouillons compris : le staff et les formateurs.
alter policy formations_interne_lit_tout on public.formations
  using (public.is_staff() or public.has_role('formateur'));

-- Les statistiques de conversion : le staff seul.
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
  if not public.is_staff() then
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
