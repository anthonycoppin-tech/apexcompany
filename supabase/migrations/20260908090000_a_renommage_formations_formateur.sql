-- ═══════════════════════════════════════════════════════════════════════════
-- Révision 3 — renommages de vocabulaire
--
-- `offres` devient `formations`, le rôle `coach` devient `formateur`. Décision
-- tranchée par le chef de projet ; la spécification fait foi (01-CAHIER-DES-
-- CHARGES.md §5). Rien n'est en production : c'est le moment ou jamais.
--
-- Ce fichier ne renomme QUE. Aucune table n'apparaît, aucune ne disparaît, et
-- aucune politique ne change de sens. Les suppressions sont dans la migration
-- suivante, pour qu'une relecture puisse traiter les deux séparément.
-- ═══════════════════════════════════════════════════════════════════════════

-- L'énumération ────────────────────────────────────────────────────────────
-- Renommer une valeur d'enum conserve son OID. Les constantes stockées dans
-- les politiques RLS (`has_role('coach')`) pointent sur cet OID, pas sur le
-- libellé : elles suivent le renommage sans être réécrites. C'est ce qui rend
-- l'opération sûre malgré son air brutal.
alter type public.app_role rename value 'coach' to 'formateur';

-- La table du catalogue ────────────────────────────────────────────────────

alter table public.offres rename to formations;

alter table public.formations rename constraint offres_pkey             to formations_pkey;
alter table public.formations rename constraint offres_slug_key         to formations_slug_key;
alter table public.formations rename constraint offres_prix_positif     to formations_prix_positif;
alter table public.formations rename constraint offres_slug_format      to formations_slug_format;
alter index public.offres_actif_ordre_idx rename to formations_actif_ordre_idx;
alter trigger offres_set_updated_at on public.formations rename to formations_set_updated_at;
alter trigger audit_offres          on public.formations rename to audit_formations;

alter policy offres_publiques_en_lecture on public.formations rename to formations_publiques_en_lecture;
alter policy offres_interne_lit_tout     on public.formations rename to formations_interne_lit_tout;
alter policy offres_staff_ecrit          on public.formations rename to formations_staff_ecrit;

-- Les colonnes qui la référencent ──────────────────────────────────────────

alter table public.inscriptions rename column offre_id to formation_id;
alter table public.inscriptions rename constraint inscriptions_offre_id_fkey to inscriptions_formation_id_fkey;

alter table public.orders rename column offre_id to formation_id;
alter table public.orders rename constraint orders_offre_id_fkey to orders_formation_id_fkey;

-- `produit_recommande_id` plutôt que `formation_recommandee_id` : la colonne
-- fait couple avec `produit_souhaite_id` (migration du formulaire), et les deux
-- désignent ce que le prospect veut et ce qu'on lui vend, pas une table.
alter table public.leads rename column offre_recommandee_id to produit_recommande_id;
alter table public.leads rename constraint leads_offre_recommandee_fkey to leads_produit_recommande_fkey;

alter table public.suivi_notes rename column coach_id to formateur_id;
alter table public.suivi_notes rename constraint suivi_notes_coach_id_fkey to suivi_notes_formateur_id_fkey;
alter index public.suivi_notes_coach_id_idx rename to suivi_notes_formateur_id_idx;

-- `sessions.coach_id`, `coaching_sessions.coach_id` et `cohorte_coachs` ne sont
-- pas renommés : ces tables disparaissent dans la migration suivante.
