-- Un consentement porte toujours l'email, parce qu'il doit survivre au compte.
--
-- **Le défaut, trouvé le 24 septembre 2026 en essayant de supprimer un compte
-- de test** : la suppression échoue, et pour une raison qui ne se devine pas.
--
--   consents.user_id ... on delete set null
--   check (user_id is not null or email is not null)
--
-- Les deux sont justes séparément. Ensemble, ils s'annulent : quand le compte
-- part, `user_id` passe à NULL, la ligne n'a plus aucun identifiant, la
-- contrainte la refuse, et **c'est la suppression entière qui casse** sur un
-- `23514` parlant de `consents` — à mille lieues de ce qu'on croyait faire.
--
-- Or `creerCompteEtSession()` n'écrivait que `user_id`. **Tout compte né du
-- formulaire était donc indestructible**, et personne ne l'avait vu parce que
-- personne n'avait encore eu à supprimer un client.
--
-- ── Ce que ça bloquait vraiment ─────────────────────────────────────────────
--
-- Pas un détail de ménage : le droit à l'effacement. Un client qui demande la
-- suppression de son compte, et la purge à dix ans prévue par la politique de
-- confidentialité, butaient tous les deux là-dessus — au moment précis où il
-- faut pouvoir prouver qu'on sait effacer.
--
-- ── Pourquoi l'email plutôt qu'un `on delete cascade` ───────────────────────
--
-- Parce que la table est **append-only et sert de preuve** : « la preuve exigée
-- par le RGPD est historique », dit son propre commentaire. Effacer le
-- consentement avec le compte, ce serait détruire la trace de ce à quoi la
-- personne a consenti — exactement ce qu'on veut pouvoir produire le jour où
-- elle le conteste, c'est-à-dire le jour où son compte n'existe plus.
--
-- L'email est le bon identifiant durable : on le connaît toujours au moment du
-- consentement, c'est par lui que la personne se désigne, et le parcours de
-- paiement l'écrivait déjà (`lib/paiement/checkout.ts`). Seule l'inscription
-- l'omettait.
--
-- La contrainte `consents_identifie` disparaît : avec un email obligatoire,
-- elle ne peut plus échouer. Une contrainte toujours vraie n'est pas un filet,
-- c'est du bruit qu'on finit par croire protecteur.

-- Les lignes existantes d'abord : sans ça, le `set not null` échoue.
update public.consents c
   set email = p.email
  from public.profiles p
 where c.email is null
   and c.user_id = p.id;

-- S'il en restait — un consentement dont le compte est déjà parti, donc sans
-- rien pour le rattacher — on ne les invente pas. La requête les nomme :
--   select id, type, created_at from public.consents where email is null;
-- Il n'y en avait aucun le 24 septembre 2026, ni sur la base partagée ni dans
-- le jeu d'essai.

alter table public.consents
  alter column email set not null;

alter table public.consents
  drop constraint consents_identifie;

comment on column public.consents.email is
  'Obligatoire, même quand `user_id` est renseigné. C''est l''identifiant qui '
  'survit à la suppression du compte — `user_id` passe alors à NULL, et sans '
  'email la ligne devient orpheline, ce qui faisait échouer la suppression '
  'elle-même. Un consentement est une preuve : il doit rester lisible après le '
  'départ de la personne qu''il concerne.';
