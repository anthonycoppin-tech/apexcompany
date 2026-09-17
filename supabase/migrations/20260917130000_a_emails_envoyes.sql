-- ═══════════════════════════════════════════════════════════════════════════
-- Le registre des emails transactionnels
--
-- Les emails partent d'une tâche planifiée, pas des handlers : confirmation de
-- paiement, proposition reçue, relance de la liaison Discord, fin d'accès
-- proche. Comme pour Discord, **l'envoi ne doit ni se perdre ni se répéter** —
-- un webhook rejoué ne doit pas envoyer deux « Paiement reçu », une panne du
-- prestataire ne doit pas en faire oublier un.
--
-- Une ligne par email, identifiée par (modèle, clé) : la clé est l'objet dont
-- l'email parle — une commande, une proposition, une inscription et sa date de
-- fin. La contrainte d'unicité est le verrou : la tâche réserve la ligne
-- AVANT d'appeler le prestataire, et une seconde exécution concurrente ne
-- réserve rien.
--
-- L'adresse est conservée : c'est la preuve de l'endroit où l'email est parti,
-- celle qu'on demande quand quelqu'un dit ne rien avoir reçu. Elle suit le
-- compte — effacé, purgé — par la cascade sur `user_id`.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.emails_envoyes (
  id             uuid primary key default gen_random_uuid(),
  modele         text not null,
  cle            text not null,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  destinataire   text not null,
  statut         text not null default 'en_cours'
                 check (statut in ('en_cours', 'envoye', 'echec')),
  tentatives     integer not null default 0,
  fournisseur_id text,
  erreur         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint emails_envoyes_une_fois unique (modele, cle)
);

create index emails_envoyes_user_id_idx on public.emails_envoyes (user_id);
create index emails_envoyes_statut_idx on public.emails_envoyes (statut)
  where statut <> 'envoye';

create trigger emails_envoyes_set_updated_at
  before update on public.emails_envoyes
  for each row execute function public.set_updated_at();

alter table public.emails_envoyes enable row level security;

-- Le staff lit, pour répondre à « je n'ai rien reçu ». Personne n'écrit par
-- l'API : seule la tâche planifiée, en clé de service, remplit ce registre.
create policy emails_envoyes_staff_lit on public.emails_envoyes
  for select to authenticated
  using (public.is_staff());

comment on table public.emails_envoyes is
  'Un email transactionnel par (modèle, clé), réservé avant l''envoi : ni perdu ni répété. '
  'Écrit par la tâche planifiée en clé de service, lu par le staff.';
