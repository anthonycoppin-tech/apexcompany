-- ═══════════════════════════════════════════════════════════════════════════
-- Un remboursement ne se supprime pas
--
-- Question laissée ouverte le 15 septembre : `audit_refunds` ne trace pas la
-- suppression, faut-il l'ajouter ? Tranché le 16 septembre : la question est
-- mal posée. Une ligne de `refunds` est un mouvement d'argent, ou la demande
-- d'en faire un. Elle n'a aucune raison d'être supprimée — une demande écartée
-- passe en `refuse`, elle ne disparaît pas. Tracer la suppression
-- documenterait un geste qui ne devrait pas exister ; on l'interdit, comme
-- pour les factures émises.
--
-- La politique `refunds_staff` (`for all`) laissait un admin supprimer une
-- ligne depuis n'importe quel client connecté. Le déclencheur s'applique à
-- tous, clé serveur comprise : la RLS ne protège pas de la clé serveur, un
-- déclencheur si.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.refunds_non_supprimables()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Un remboursement ne se supprime pas. Une demande écartée passe en « refuse ».'
    using errcode = 'restrict_violation';
end;
$$;

create trigger refunds_pas_de_suppression
  before delete on public.refunds
  for each row execute function public.refunds_non_supprimables();
