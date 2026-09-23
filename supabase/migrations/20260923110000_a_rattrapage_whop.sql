-- Rattacher un paiement Whop arrivé sans métadonnées.
--
-- Le client a diffusé seize liens de paiement Whop avant que le site ne sache
-- les produire lui-même, et un lien envoyé en message privé ne se rappelle
-- pas. Un paiement qui arrive par l'un d'eux n'a aucune métadonnée : ni compte,
-- ni produit. Le webhook ne peut alors qu'acquitter et journaliser — et le
-- symptôme côté client est « j'ai payé et je n'ai pas accès », en silence.
-- C'est exactement la panne que `/admin/aide` est rangée pour traiter.
--
-- Cette colonne referme la moitié du problème : **un paiement arrivant sur un
-- plan connu sait quel produit a été acheté**, même sans métadonnée. L'autre
-- moitié — qui a payé — se rapproche par l'adresse email de l'acheteur, et ce
-- qui reste tombe dans une file nommée du back-office plutôt que dans un
-- journal que personne ne relit.
--
-- Elle ne remplace pas les métadonnées et ne doit pas le devenir : un paiement
-- ouvert par le site porte `user_id` et `formation_id`, qui disent qui et quoi
-- sans dépendre d'une correspondance. Le plan n'est qu'un filet.

alter table public.formations
  add column whop_plan_id text;

comment on column public.formations.whop_plan_id is
  'Identifiant du plan Whop (`plan_…`) pour les liens de paiement diffusés hors du site. '
  'Sert UNIQUEMENT à rattacher un encaissement arrivé sans métadonnées : le parcours normal '
  'déclare le produit dans les métadonnées de la session. Nul pour un produit qui n''a jamais '
  'eu de lien public.';

-- Deux produits ne peuvent pas revendiquer le même plan : le rattachement
-- deviendrait ambigu au moment précis où on en a besoin. Index partiel, parce
-- que la plupart des produits n'ont pas de lien diffusé.
create unique index formations_whop_plan_id_key
  on public.formations (whop_plan_id)
  where whop_plan_id is not null;
