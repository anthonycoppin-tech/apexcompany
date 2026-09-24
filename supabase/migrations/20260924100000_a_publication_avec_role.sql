-- Un produit publié doit déclarer son rôle Discord — et c'est la base qui le
-- dit, désormais.
--
-- **La règle existait, mais seulement dans un écran.** `enregistrerFormation()`
-- refuse depuis le 13 septembre 2026 de publier un produit sans
-- `discord_role_id`, et son commentaire le dit franchement : « Celle-là
-- n'existe nulle part ailleurs ». Tout le reste du dépôt a pourtant fini par
-- affirmer le contraire — la migration du catalogue du 23 septembre, le README
-- du bot, `08-CE-QUI-MANQUE.md` et `10-MISE-EN-PRODUCTION.md` écrivent tous
-- « la base refuse un produit publié sans rôle ». C'était faux, et personne ne
-- l'aurait vu avant d'en avoir besoin.
--
-- Ce qui a fini par le montrer : un `update` en SQL pour publier un produit le
-- soir d'une démo. Un chemin qui contourne l'écran contourne la seule
-- vérification, et rien ne l'arrête.
--
-- ── Ce que la règle protège ─────────────────────────────────────────────────
--
-- Le pire scénario du système : un produit qui se vend, s'encaisse, ouvre une
-- commande, une inscription et une facture — et n'ouvre **aucun accès**.
-- `traiter_paiement()` journalise bien l'échec (`paiement.discord`, raison « La
-- formation ne déclare aucun rôle Discord »), mais le client, lui, a payé et
-- n'a rien. Côté support, le symptôme est « j'ai payé et je n'ai pas accès »,
-- qu'on n'apprend que s'il se plaint.
--
-- ── Pourquoi une contrainte et pas un déclencheur ───────────────────────────
--
-- Parce qu'elle se lit dans le schéma, qu'elle s'applique à toute écriture quel
-- qu'en soit le chemin, et qu'elle ne peut pas être oubliée dans une branche.
-- L'écran garde sa vérification : un message en français vaut mieux qu'un code
-- 23514, et il dit *pourquoi* c'est refusé. Les deux ne font pas double emploi
-- — l'un explique, l'autre garantit.
--
-- ── Si cette migration échoue ───────────────────────────────────────────────
--
-- C'est qu'un produit publié n'a pas de rôle, quelque part. Ce n'est pas la
-- migration qu'il faut corriger : c'est ce produit, qui est en vente et
-- n'ouvre rien.
--
--   select id, slug, titre from public.formations
--    where actif and discord_role_id is null;

alter table public.formations
  add constraint formations_publie_avec_role check (
    not actif or discord_role_id is not null
  );

comment on constraint formations_publie_avec_role on public.formations is
  'Un produit publié déclare son rôle Discord. Sans lui, il encaisse un '
  'paiement, ouvre une inscription et une facture, et n''ouvre aucun accès : '
  'le client paie et n''a rien. Un brouillon, lui, peut très bien attendre son '
  'rôle — c''est l''état dans lequel arrive un catalogue livré par le client.';
