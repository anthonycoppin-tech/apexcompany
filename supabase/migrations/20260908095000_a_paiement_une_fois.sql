-- ═══════════════════════════════════════════════════════════════════════════
-- Révision 3 — le paiement en une fois
--
-- Arbitré par le chef de projet le 8 septembre 2026 : pas de paiement en
-- plusieurs fois. `payment_schedules` était conservée en attendant cette
-- réponse (04-DATA-MODEL.md, 01-CAHIER-DES-CHARGES.md §8.3). La réponse est
-- venue : la table part.
--
-- Une table morte n'est pas neutre. Elle apparaît dans les types générés, dans
-- les écrans de back-office, dans la revue de sécurité, et elle finit par se
-- faire remplir « au cas où ». Si le 3× revient, il reviendra par une migration
-- — et git garde ce fichier pour la retrouver.
-- ═══════════════════════════════════════════════════════════════════════════

drop table public.payment_schedules;

drop type public.echeance_statut;

-- `echelonne` sur la commande n'a plus rien à distinguer : toute commande est
-- réglée en une fois.
alter table public.orders drop column echelonne;
