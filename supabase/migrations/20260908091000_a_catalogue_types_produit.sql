-- ═══════════════════════════════════════════════════════════════════════════
-- Révision 3 — les trois types de produit
--
-- Abonnement mensuel, accompagnement acheté en une fois pour 1/3/6 mois, et
-- formation à accès illimité. Deux mécaniques de paiement, UNE SEULE mécanique
-- d'accès : `inscriptions.date_fin_acces`, avec `null` pour illimité.
-- Voir 01-CAHIER-DES-CHARGES.md §1 et 04-DATA-MODEL.md.
--
-- Cette migration passe AVANT la suppression des cohortes : `discord_role_id`
-- vit encore sur `cohortes` et doit être remonté au produit avant que la table
-- ne parte, sinon l'association côté serveur Discord est perdue.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.type_produit as enum ('abonnement', 'accompagnement', 'formation');

-- Axe distinct de `type_produit`, et les fusionner serait une erreur : le
-- premier dit comment le cours se donne, le second comment il se paie. Un
-- accompagnement peut être un tête-à-tête comme un groupe qui avance ensemble.
create type public.modalite_formation as enum ('individuel', 'groupe');

-- Les valeurs par défaut ne servent qu'au remplissage des lignes existantes ;
-- elles sont retirées plus bas pour qu'un nouveau produit doive déclarer ce
-- qu'il est. Un défaut qui survit classe en silence.
alter table public.formations
  add column type_produit      public.type_produit        not null default 'formation',
  add column modalite          public.modalite_formation  not null default 'groupe',
  add column duree_acces_jours integer,
  add column discord_role_id   text;

comment on column public.formations.duree_acces_jours is
  '30 / 90 / 180 pour un accompagnement. NULL = accès illimité — c''est ce NULL qui '
  'donne aux formations leur accès à vie sans cas particulier dans le code, puisque la '
  'révocation quotidienne ne sélectionne jamais une date_fin_acces nulle.';

comment on column public.formations.discord_role_id is
  'Déplacé depuis cohortes. Le rôle attribué à l''inscription et retiré en fin d''accès. '
  'Sans lui, le produit n''a aucune existence côté serveur Discord.';

comment on column public.formations.modalite is
  'Colonne d''information : fiche produit et back-office. Elle ne touche ni à l''accès '
  'ni à la planification, qui se fait hors plateforme (01-CAHIER-DES-CHARGES.md §3, '
  'étape 4 bis).';

-- Reprise du rôle Discord depuis la cohorte la plus ancienne du produit.
-- Plusieurs cohortes portaient des rôles distincts pour un même produit ; sans
-- cohortes, un produit n'a qu'un rôle. On garde le premier, déterministe.
update public.formations f
set discord_role_id = c.discord_role_id
from (
  select distinct on (offre_id) offre_id, discord_role_id
  from public.cohortes
  where discord_role_id is not null
  order by offre_id, date_debut, id
) c
where c.offre_id = f.id;

alter table public.formations
  alter column type_produit drop default,
  alter column modalite     drop default;

-- L'invariant du tableau de 04-DATA-MODEL.md, écrit en contrainte plutôt qu'en
-- convention : un accompagnement a une durée, les deux autres n'en ont pas.
-- L'abonnement repousse sa date d'accès à chaque prélèvement, la formation ne
-- la voit jamais arriver.
alter table public.formations
  add constraint formations_duree_acces_coherente check (
    (type_produit = 'accompagnement' and duree_acces_jours is not null and duree_acces_jours > 0)
    or (type_produit <> 'accompagnement' and duree_acces_jours is null)
  );

-- Paiement en une fois : arbitré par le chef de projet le 8 septembre 2026.
-- Les deux colonnes d'échelonnement du catalogue n'ont plus d'objet ; la table
-- payment_schedules part dans la migration dédiée au paiement.
alter table public.formations
  drop column paiement_echelonne_possible,
  drop column nb_echeances_max;
