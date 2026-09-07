-- ═══════════════════════════════════════════════════════════════════════════
-- Extensions et types énumérés
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- Identité ─────────────────────────────────────────────────────────────────
create type public.app_role as enum ('client', 'coach', 'branding', 'admin', 'owner');

-- Commercial ───────────────────────────────────────────────────────────────
create type public.lead_source as enum (
  'instagram', 'youtube', 'tiktok', 'snapchat', 'direct', 'parrainage'
);

create type public.lead_statut as enum (
  'nouveau', 'contacte', 'rdv', 'proposition', 'gagne', 'perdu'
);

create type public.appointment_statut as enum (
  'planifie', 'confirme', 'honore', 'absent', 'annule', 'reporte'
);

-- Cohortes et sessions ─────────────────────────────────────────────────────
create type public.cohorte_statut as enum ('brouillon', 'ouverte', 'complete', 'en_cours', 'terminee');

create type public.inscription_statut as enum ('active', 'suspendue', 'terminee', 'remboursee');

create type public.session_type as enum ('live', 'call_groupe');

create type public.session_statut as enum ('planifiee', 'en_cours', 'terminee', 'annulee');

create type public.suivi_note_type as enum ('objectif', 'observation', 'retour');

create type public.coaching_statut as enum ('planifiee', 'honoree', 'absente', 'annulee');

-- Paiement ─────────────────────────────────────────────────────────────────
create type public.payment_provider as enum ('stripe', 'paypal');

create type public.order_statut as enum ('brouillon', 'en_attente', 'payee', 'partielle', 'annulee', 'remboursee');

create type public.payment_statut as enum ('en_attente', 'reussi', 'echoue', 'rembourse');

create type public.echeance_statut as enum ('a_venir', 'due', 'payee', 'echouee', 'annulee');

create type public.refund_statut as enum ('demande', 'approuve', 'refuse', 'traite');

create type public.dispute_statut as enum ('ouvert', 'preuves_envoyees', 'gagne', 'perdu', 'clos');

-- Discord ──────────────────────────────────────────────────────────────────
create type public.discord_action as enum ('grant', 'revoke');

create type public.queue_statut as enum ('en_attente', 'en_cours', 'reussi', 'echoue', 'abandonne');

-- Traçabilité ──────────────────────────────────────────────────────────────
create type public.automation_statut as enum ('succes', 'echec', 'ignore');

create type public.consent_type as enum ('cgv', 'confidentialite', 'cookies', 'marketing');
