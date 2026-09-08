-- ═══════════════════════════════════════════════════════════════════════════
-- Deux politiques manquantes, découvertes en construisant l'espace client
--
-- La matrice d'accès de `02-SITEMAP.md` donne au client la lecture de SES
-- rendez-vous (« Rendez-vous | les siens | les siens | — | ✓ | ✓ »), et
-- `/espace/rendez-vous` figure dans son arborescence depuis la révision 3.
-- Aucune politique ne le permettait : la table n'était ouverte qu'au staff, puis
-- au formateur. L'écran aurait affiché une liste vide, sans erreur — le genre de
-- panne qu'on met une demi-journée à comprendre parce que rien ne casse.
--
-- C'est aussi une illustration de la règle : la RLS est la sécurité, pas le
-- filtre d'affichage. Ajouter un `where` dans la page n'aurait rien montré de
-- plus, et c'est très bien ainsi.
-- ═══════════════════════════════════════════════════════════════════════════

-- Le rattachement passe par le prospect : c'est `leads.user_id` qui relie une
-- personne à son rendez-vous, `appointments` ne portant pas de `user_id`. Le
-- tunnel inversé garantit que ce lien existe — le compte est créé avant la
-- réservation.
--
-- **SECURITY DEFINER, et ce n'est pas un raccourci.** Une sous-requête écrite
-- directement dans le `using` serait elle-même soumise à la RLS de la table
-- qu'elle interroge : le client n'a aucune politique de lecture sur `leads`, la
-- sous-requête ne verrait donc rien, et la politique refuserait tout en
-- silence. C'est la même raison qui a fait écrire `has_role()` et
-- `est_mon_inscription()` ainsi. Le piège ne se voit pas à la relecture — la
-- politique paraît juste — et se manifeste par un écran vide sans erreur.
create or replace function public.est_mon_lead(l uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.leads
    where id = l and user_id = auth.uid()
  );
$$;

comment on function public.est_mon_lead is
  'Le porteur de la session est-il la personne derrière ce prospect ? Contourne la RLS de '
  '`leads`, à laquelle un client n''a aucun accès direct — et ne renvoie qu''un booléen, '
  'donc n''expose rien du contenu de la fiche.';

create policy appointments_client_lit_les_siens on public.appointments
  for select to authenticated
  using (public.est_mon_lead(lead_id));

-- Lecture seule, volontairement. Un client n'annule pas son audit depuis le
-- site : il le fait depuis Cal.com, qui nous en informe par webhook. Lui ouvrir
-- l'écriture ici créerait deux sources de vérité pour le même créneau.

-- ── Le catalogue, pour ce qu'on a déjà acheté ────────────────────────────────
-- `formations_publiques_en_lecture` ne montre que les produits actifs. Un client
-- dont le produit a été retiré du catalogue depuis son achat verrait son propre
-- accès sans titre ni description — son inscription resterait lisible, mais la
-- formation à laquelle elle renvoie, non.
create policy formations_client_lit_les_siennes on public.formations
  for select to authenticated
  using (
    exists (
      select 1 from public.inscriptions i
      where i.formation_id = public.formations.id
        and i.user_id = auth.uid()
    )
    or exists (
      select 1 from public.propositions p
      where p.formation_id = public.formations.id
        and p.user_id = auth.uid()
    )
  );

-- Les propositions comptent autant : un formateur peut proposer un produit qui
-- n'est pas publié au catalogue — un accompagnement sur mesure, un tarif
-- réservé — et le client doit pouvoir lire ce qu'on lui propose.
