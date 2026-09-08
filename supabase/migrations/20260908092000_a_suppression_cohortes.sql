-- ═══════════════════════════════════════════════════════════════════════════
-- Révision 3 — la fin des cohortes, des sessions, des présences, des replays
--
-- Le parcours est individuel : il n'y a plus de promotion à ouvrir, plus
-- d'émargement, et les replays vivent sur Discord. C'est la migration la plus
-- délicate du lot — elle emporte l'ancrage de sécurité du rôle formateur, qui
-- passe de `cohorte_coachs` à `inscriptions.formateur_id`. La relecture d'une
-- politique RLS modifiée est l'une des deux qui comptent (07-REPARTITION.md).
--
-- L'invariant ne s'assouplit pas : un formateur ne voit QUE ses affectations.
-- Seul son énoncé change. Les politiques de remplacement sont dans la migration
-- `_rls_formateur` ; entre les deux fichiers, le formateur n'a accès à rien, ce
-- qui est le bon sens de lecture d'une bascule de sécurité.
-- ═══════════════════════════════════════════════════════════════════════════

-- Politiques portées par des tables qui SURVIVENT mais qui dépendent d'objets
-- supprimés ici. Sans ces drops explicites, la suppression échoue sur la
-- dépendance — ce qui est une bonne chose : elle oblige à dire lesquelles on
-- retire.
drop policy profiles_coach_lit_sa_cohorte    on public.profiles;
drop policy inscriptions_coach_lit_sa_cohorte on public.inscriptions;
drop policy suivi_notes_coach                 on public.suivi_notes;

-- Le nouvel ancrage de sécurité ────────────────────────────────────────────

alter table public.inscriptions
  add column formateur_id uuid references public.profiles (id) on delete set null;

comment on column public.inscriptions.formateur_id is
  'Affectation explicite, et non dérivée des rendez-vous : « il a eu un appel avec cette '
  'personne un jour » élargit le périmètre en silence à chaque RDV repris d''un collègue '
  'absent, et ne se teste pas proprement. Au singulier : tout client passe par le '
  'formateur qui dirige, et le passage de relais est une conversation, pas une donnée.';

-- Une politique s'évalue ligne à ligne. Sans index, les performances
-- s'effondrent dès quelques milliers de lignes.
create index inscriptions_formateur_id_idx on public.inscriptions (formateur_id);

-- Le filet contre la double inscription ────────────────────────────────────
-- L'unicité portait sur (user_id, cohorte_id). Sans cohortes, elle porte sur
-- (user_id, formation_id) — mais restreinte aux inscriptions ACTIVES, sinon un
-- client dont l'accompagnement s'est terminé ne pourrait jamais en racheter un.
-- Le filet contre le webhook rejoué est conservé, le renouvellement reste
-- possible.
alter table public.inscriptions drop constraint inscriptions_user_id_cohorte_id_key;

create unique index inscriptions_une_seule_active_par_formation
  on public.inscriptions (user_id, formation_id)
  where statut = 'active';

alter table public.inscriptions drop column cohorte_id;
alter table public.orders       drop column cohorte_id;

-- Les tables ───────────────────────────────────────────────────────────────
-- Dans l'ordre des dépendances : ce qui référence avant ce qui est référencé.

drop table public.presences;
drop table public.replays;
drop table public.coaching_sessions;
drop table public.sessions;
drop table public.cohorte_coachs;
drop table public.cohortes;

-- Les fonctions de rattachement qui n'ont plus d'objet ─────────────────────

drop function public.coach_de_cohorte(uuid);
drop function public.coach_de_inscription(uuid);
drop function public.coach_de_session(uuid);
drop function public.est_inscrit_cohorte(uuid);
drop function public.est_inscrit_session(uuid);

drop type public.cohorte_statut;
drop type public.session_type;
drop type public.session_statut;
drop type public.coaching_statut;
