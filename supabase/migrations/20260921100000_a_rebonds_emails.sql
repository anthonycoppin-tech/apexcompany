-- ═══════════════════════════════════════════════════════════════════════════
-- Ce que Resend nous apprend après l'envoi : livré, rebond, plainte
--
-- Jusqu'ici `envoye` voulait dire « Resend a accepté la requête », et le
-- registre s'arrêtait là. C'est la limite qui compte : une adresse morte, une
-- boîte pleine ou un client qui clique sur « spam » laissaient la ligne en
-- `envoye`, et `/admin/emails` affirmait tranquillement qu'un email était parti
-- chez quelqu'un qui ne l'a jamais eu. Une page qui affirme ce qui n'est pas.
--
-- Trois états s'ajoutent, tous écrits par le webhook `api/resend` :
--
--   `livre`   — le serveur du destinataire a accepté le message. C'est la
--               seule preuve de réception qu'on puisse avoir.
--   `rebond`  — refusé définitivement (adresse inexistante) ou temporairement
--               (boîte pleine).
--   `plainte` — le destinataire l'a marqué comme indésirable.
--
-- **`rebond` et `plainte` ne se retentent pas**, et c'est la raison pour
-- laquelle ce sont des états à part plutôt qu'un `echec` avec un message.
-- `echec` veut dire « on réessaie » dans `peutReprendre()` : y ranger un rebond
-- ferait relancer trois fois une adresse qui n'existe pas, ce qui est
-- exactement la façon dont on abîme la réputation d'un domaine expéditeur.
--
-- L'ordre d'arrivée n'est pas garanti par le prestataire : la logique qui
-- empêche un `livre` tardif d'écraser un `rebond` est dans
-- `apps/web/src/lib/email/rebonds.ts`, testée sans base.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.emails_envoyes
  drop constraint emails_envoyes_statut_check;

alter table public.emails_envoyes
  add constraint emails_envoyes_statut_check
  check (statut in ('en_cours', 'envoye', 'livre', 'rebond', 'plainte', 'echec'));

-- L'index sert à retrouver ce qui demande une action humaine. `envoye` et
-- `livre` n'en demandent aucune et restent hors de l'index ; `rebond` et
-- `plainte` y entrent, puisque ce sont précisément les lignes qu'on vient
-- chercher quand quelqu'un dit n'avoir rien reçu.
drop index if exists public.emails_envoyes_statut_idx;

create index emails_envoyes_statut_idx on public.emails_envoyes (statut)
  where statut in ('en_cours', 'echec', 'rebond', 'plainte');

comment on column public.emails_envoyes.statut is
  'en_cours, envoye (accepté par le prestataire), livre (accepté par le destinataire), '
  'rebond et plainte (terminaux, jamais retentés), echec (retenté jusqu''à trois fois).';

comment on table public.emails_envoyes is
  'Un email transactionnel par (modèle, clé), réservé avant l''envoi : ni perdu ni répété. '
  'Écrit par la tâche planifiée et par le webhook Resend, en clé de service, lu par le staff.';
