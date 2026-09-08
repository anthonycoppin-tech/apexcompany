-- ═══════════════════════════════════════════════════════════════════════════
-- Révision 3 — le formulaire de qualification et l'issue du rendez-vous
--
-- Le tunnel est inversé : le formulaire est natif, il crée le compte, et ses
-- réponses deviennent la fiche que le formateur lit avant l'audit. Les valeurs
-- d'énumération sont relevées sur le formulaire Tally en production
-- (01-CAHIER-DES-CHARGES.md §9).
--
-- Les colonnes de `leads` sont une PROJECTION destinée au tri et au filtrage.
-- La soumission complète vit en jsonb dans `lead_events`, sous le type
-- `formulaire_soumis`, et reste lisible même si les questions changent. C'est
-- pour ça qu'elles sont toutes nullables ici : un lead saisi à la main par un
-- admin n'a jamais répondu au formulaire. L'obligation de réponse est portée
-- par le formulaire, pas par le schéma.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.zone_geo as enum ('europe', 'amerique', 'asie', 'oceanie', 'afrique');

-- Pas de `moins_18`. Le refus est dur et intervient AVANT toute écriture en
-- base : un mineur ne devient jamais un lead. Une valeur d'énumération qui ne
-- peut pas exister en base n'a pas à y être déclarée.
create type public.tranche_age as enum ('18_25', '25_35', '35_50', 'plus_50');

create type public.situation_pro as enum ('salarie', 'independant', 'etudiant', 'sans_emploi');

create type public.niveau_trading as enum ('decouverte', 'debutant', 'intermediaire', 'avance');

create type public.prop_firm_statut as enum ('non', 'en_challenge', 'oui');

create type public.blocage_trading as enum ('strategie', 'discipline', 'gestion_risque', 'prop_firm');

create type public.tranche_budget as enum ('500_1000', '1000_2000', '2000_5000', 'plus_5000');

create type public.delai_objectif as enum ('immediat', 'mois_prochain', 'trois_mois');

alter table public.leads
  add column user_id             uuid references public.profiles (id) on delete set null,
  add column zone_geo            public.zone_geo,
  add column tranche_age         public.tranche_age,
  add column situation_pro       public.situation_pro,
  add column niveau_trading      public.niveau_trading,
  add column prop_firm           public.prop_firm_statut,
  add column blocage             public.blocage_trading,
  add column tranche_budget      public.tranche_budget,
  add column delai_objectif      public.delai_objectif,
  add column eligible            boolean,
  add column produit_souhaite_id uuid references public.formations (id) on delete set null;

-- Un compte, un lead. L'unicité empêche deux fiches concurrentes pour la même
-- personne après une deuxième soumission du formulaire. Index partiel : les
-- leads importés d'avant le tunnel inversé n'ont pas de compte.
create unique index leads_user_id_key on public.leads (user_id) where user_id is not null;

create index leads_produit_souhaite_idx on public.leads (produit_souhaite_id);

comment on column public.leads.user_id is
  'Tout lead a désormais un compte : le tunnel inversé le crée AVANT le rendez-vous, ce '
  'qui permet à la RLS de protéger la proposition sans jeton signé public.';

comment on column public.leads.eligible is
  'Résultat du filtrage par le formulaire. NULL = pas encore évalué. La règle elle-même '
  'reste à obtenir du client (01-CAHIER-DES-CHARGES.md §8.1) : tant qu''elle est inconnue, '
  'la colonne existe mais personne ne l''écrit.';

comment on column public.leads.situation_pro is
  'Écran 3 du formulaire, question obligatoire. Colonne plutôt que simple payload jsonb : '
  'énumération fermée et critère de segmentation commerciale, au même titre que '
  'tranche_budget. La laisser dans le seul jsonb la rendrait infiltrable au CRM.';

comment on column public.leads.prop_firm is
  'Écran 5 du formulaire, question obligatoire. Même raisonnement que situation_pro : '
  'réussir une prop firm est aussi une valeur de blocage, les deux se croisent au tri.';

comment on column public.leads.produit_souhaite_id is
  'Ce que le prospect déclare vouloir, distinct de produit_recommande_id retenu par le '
  'formateur après l''audit. Les fusionner ferait disparaître l''écart entre ce que les '
  'gens croient vouloir et ce qu''on leur vend.';

-- Servent le tri du CRM et le filtre du tableau de bord formateur.
create index leads_eligible_idx       on public.leads (eligible);
create index leads_tranche_budget_idx on public.leads (tranche_budget);

-- L'issue du rendez-vous ───────────────────────────────────────────────────
-- Sans elle, pas de statistique de no-show — le premier poste de perte d'un
-- tunnel de vente par appel.

create type public.rdv_issue as enum ('honore', 'absent', 'annule');

alter table public.appointments
  add column issue        public.rdv_issue,
  add column compte_rendu text;

comment on column public.appointments.issue is
  'Consignée par le FORMATEUR après l''appel, là où `statut` est écrit par le webhook '
  'Cal.com. Les deux se recouvrent partiellement (honore / absent / annule existent aussi '
  'dans appointment_statut) et c''est voulu : un booking « confirmé » côté Cal.com peut '
  'très bien être un no-show. Faire dépendre la statistique de no-show d''une colonne que '
  'le prestataire écrit la rendrait fausse le jour où il change de vocabulaire. '
  'NULL tant que le rendez-vous n''a pas eu lieu : c''est ce qui distingue « à venir » '
  'de « absent ».';
