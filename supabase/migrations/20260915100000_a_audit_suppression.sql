-- Audit de la suppression du contenu publié.
--
-- `trace_audit()` sait déjà tout faire pour un DELETE : elle lit `old.id`,
-- range l'ancienne ligne entière dans `avant`, laisse `apres` à null et
-- retourne `old`. Rien à changer dans la fonction — seuls les déclencheurs ne
-- l'appelaient pas sur cet événement.
--
-- Ce que ça répare, et pourquoi ça compte surtout pour les témoignages :
-- un témoignage porte le nom d'une personne réelle et ses mots, publiés avec
-- son accord. Le supprimer effaçait jusqu'ici la seule trace de cet accord.
-- C'est précisément la trace qu'on veut pouvoir produire le jour où cette
-- personne conteste avoir consenti — c'est-à-dire le jour où la ligne n'existe
-- plus. Une suppression tracée garde l'enregistrement complet dans
-- `audit_logs.avant`, auteur et horodatage compris.
--
-- `formations` est dans la même migration bien que le sujet d'origine ne
-- nomme que le contenu éditorial : le déclencheur y a exactement le même trou,
-- hérité de `audit_offres`, et supprimer une ligne du catalogue efface un
-- produit qui a pu encaisser de l'argent. Corriger deux membres d'une famille
-- de trois est la façon dont ces oublis se perpétuent.
--
-- Restent volontairement hors de cette migration : `audit_refunds`, en
-- `after insert or update`, qui touche à l'argent et relève d'une décision à
-- part. Noté dans `docs/09-CHANTIERS.md`.
--
-- Les déclencheurs sont recréés plutôt que modifiés : PostgreSQL n'offre pas
-- d'`alter trigger` pour changer la liste des événements.

drop trigger if exists audit_temoignages on public.temoignages;
create trigger audit_temoignages
  after update or delete on public.temoignages
  for each row execute function public.trace_audit();

drop trigger if exists audit_formateurs_fiches on public.formateurs_fiches;
create trigger audit_formateurs_fiches
  after update or delete on public.formateurs_fiches
  for each row execute function public.trace_audit();

drop trigger if exists audit_formations on public.formations;
create trigger audit_formations
  after update or delete on public.formations
  for each row execute function public.trace_audit();
