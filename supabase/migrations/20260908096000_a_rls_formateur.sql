-- ═══════════════════════════════════════════════════════════════════════════
-- Révision 3 — le périmètre du rôle formateur, réancré sur l'affectation
--
-- L'invariant de CLAUDE.md survit tel quel : **un formateur ne voit que ses
-- clients, et jamais d'argent.** Seul son énoncé change — « ses cohortes »
-- devient « ses affectations », et l'ancrage passe de `cohorte_coachs` à deux
-- colonnes explicites : `inscriptions.formateur_id` et `leads.assigned_to`.
--
-- Pourquoi une affectation explicite et pas une dérivation depuis
-- `appointments` : « il a eu un appel avec cette personne un jour » paraît plus
-- simple, mais élargit le périmètre en silence à chaque rendez-vous repris d'un
-- collègue absent, et ne se teste pas proprement — le périmètre devient une
-- conséquence de l'historique au lieu d'être une décision.
--
-- Conséquence assumée, à connaître avant de s'en étonner : un formateur à qui
-- un client est confié oralement ne le voit PAS dans /formateur, puisque
-- l'affectation n'a pas bougé en base. Si un jour c'est gênant, la réponse sera
-- de déplacer l'affectation, pas d'en empiler plusieurs.
-- ═══════════════════════════════════════════════════════════════════════════

-- Les deux pivots ──────────────────────────────────────────────────────────
-- SECURITY DEFINER : elles lisent la table en contournant la RLS, ce qui évite
-- la récursion d'une politique sur inscriptions qui interrogerait inscriptions.
-- search_path figé : sans ça, un schéma temporaire peut détourner l'appel.

create or replace function public.formateur_de_inscription(i uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.inscriptions
    where id = i and formateur_id = auth.uid()
  );
$$;

comment on function public.formateur_de_inscription is
  'Le porteur de la session est-il le formateur affecté à cette inscription ? '
  'Remplace coach_de_cohorte(), qui a disparu avec les cohortes.';

create or replace function public.formateur_de_lead(l uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.leads
    where id = l and assigned_to = auth.uid()
  );
$$;

-- profiles ─────────────────────────────────────────────────────────────────
-- Un formateur a besoin du nom et des coordonnées de ses clients, et d'aucun
-- autre. Les prospects comptent autant que les inscrits : la fiche sert
-- d'abord à préparer l'audit de vente, donc avant tout achat.

create policy profiles_formateur_lit_ses_clients on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.inscriptions ins
      where ins.user_id = public.profiles.id
        and ins.formateur_id = auth.uid()
    )
    or exists (
      select 1 from public.leads l
      where l.user_id = public.profiles.id
        and l.assigned_to = auth.uid()
    )
  );

-- inscriptions — Politique 2 ───────────────────────────────────────────────
-- Noter l'absence du client ici : il passe par la politique 1
-- (inscriptions_client_lit_les_siennes, migration _rls). Ajouter une condition
-- client à cette politique-ci reviendrait à ouvrir la lecture des inscriptions
-- des autres.

create policy inscriptions_formateur_lit_ses_affectations on public.inscriptions
  for select to authenticated
  using (formateur_id = auth.uid() or public.is_staff());

-- suivi_notes ──────────────────────────────────────────────────────────────
-- Le suivi individuel est le travail du formateur : lecture et écriture sur
-- ses affectations, et signature obligatoire de ses propres notes.

create policy suivi_notes_formateur on public.suivi_notes
  for all to authenticated
  using (public.formateur_de_inscription(inscription_id))
  with check (
    public.formateur_de_inscription(inscription_id)
    and formateur_id = auth.uid()
  );

-- leads ────────────────────────────────────────────────────────────────────
-- Le formateur lit et met à jour les prospects qui lui sont affectés — c'est
-- là qu'il consigne `produit_recommande_id` après l'audit. Le `with check`
-- l'empêche de se réattribuer le prospect d'un collègue au passage.

create policy leads_formateur_lit_les_siens on public.leads
  for select to authenticated
  using (assigned_to = auth.uid());

create policy leads_formateur_modifie_les_siens on public.leads
  for update to authenticated
  using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

-- lead_events — la fiche client affiche la soumission du formulaire, qui vit
-- ici en jsonb. Lecture et insertion, jamais UPDATE ni DELETE : l'absence de
-- politique d'écriture est ce qui rend le journal réellement immuable.

create policy lead_events_formateur_lit on public.lead_events
  for select to authenticated
  using (public.formateur_de_lead(lead_id));

create policy lead_events_formateur_insere on public.lead_events
  for insert to authenticated
  with check (public.formateur_de_lead(lead_id));

-- appointments ─────────────────────────────────────────────────────────────
-- Ses audits, pour y consigner l'issue et le compte rendu.

create policy appointments_formateur_lit on public.appointments
  for select to authenticated
  using (conseiller_id = auth.uid());

create policy appointments_formateur_modifie on public.appointments
  for update to authenticated
  using (conseiller_id = auth.uid())
  with check (conseiller_id = auth.uid());

-- Sert la politique ci-dessus et le tableau de bord « mes RDV du jour ».
create index if not exists appointments_conseiller_debut_idx
  on public.appointments (conseiller_id, debut desc);

-- Ce qui reste fermé, et qui est le point principal de ce fichier ───────────
--
-- Aucune politique n'est ajoutée ici pour `orders`, `payments`, `invoices`,
-- `refunds`, `disputes`, `subscriptions` ni `payment_events`. Un formateur ne
-- voit aucun montant réellement payé, pas même celui de son propre client.
-- Cette absence est testée, pas supposée : supabase/tests/01_rls_formateur.test.sql.
