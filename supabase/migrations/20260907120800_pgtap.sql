-- ═══════════════════════════════════════════════════════════════════════════
-- pgTAP — framework des tests de politiques RLS (supabase/tests/).
--
-- Livré comme migration, donc présent aussi en production. Cest volontaire :
-- pouvoir rejouer les tests de cloisonnement contre la base réelle après une
-- migration vaut largement lextension inutilisée le reste du temps. Elle
-- nexpose rien : ses fonctions ne servent quà comparer des résultats.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgtap with schema extensions;
