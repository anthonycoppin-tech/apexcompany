/**
 * L'environnement Supabase reconstitué pour PGlite, et le chargement du schéma.
 *
 * Extrait de `verifier-schema.mjs` le 24 septembre 2026, quand un second outil
 * en a eu besoin (`rejouer-pgtap.mjs`). Deux copies auraient divergé au premier
 * ajout de colonne dans `auth.users`, et la divergence se serait vue sous la
 * forme d'un outil qui passe et d'un autre qui échoue sur le même dépôt.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
export const migrationsDir = join(racine, 'supabase', 'migrations');

/**
 * Reconstitue le strict minimum de l'environnement Supabase dont dépendent les
 * migrations : le schéma auth, les rôles anon/authenticated, et auth.uid().
 */
export const PREAMBULE = `
create schema if not exists auth;
create schema if not exists extensions;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create table if not exists auth.users (
  instance_id uuid,
  id uuid primary key,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  last_sign_in_at timestamptz,
  -- Présentes ici pour que le seed s'exécute à l'identique de la vraie base ;
  -- PGlite ne fait pas tourner GoTrue et ne peut donc pas détecter par
  -- lui-même que ces colonnes doivent être '' plutôt que NULL (voir seed.sql).
  confirmation_token text,
  recovery_token text,
  email_change text,
  email_change_token_new text,
  email_change_token_current text,
  phone_change text,
  phone_change_token text,
  reauthentication_token text
);

create table if not exists auth.identities (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete cascade,
  provider_id text,
  identity_data jsonb,
  provider text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

-- Même signature et même sémantique que chez Supabase : lidentifiant du porteur
-- de la session, lu dans les claims du JWT injectés par PostgREST.
--
-- Le nullif porte sur le RÉGLAGE, avant le cast en jsonb — comme dans la vraie
-- définition Supabase. Lécrire dans lautre sens (caster puis neutraliser)
-- paraît équivalent et ne lest pas : une session sans claims porte la chaîne
-- vide, et caster une chaîne vide en jsonb lève « invalid input syntax for type
-- json ». Le piège ne se voit quà lexécution dune fonction appelant auth.uid()
-- hors session — un trigger daudit, typiquement.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

-- pgcrypto nest pas embarqué dans PGlite ; le seed ne sen sert que pour
-- fabriquer un mot de passe de test, un substitut inerte suffit.
create or replace function extensions.crypt(text, text) returns text
language sql immutable as $$ select md5($1 || $2) $$;
create or replace function extensions.gen_salt(text) returns text
language sql volatile as $$ select 'stub-salt' $$;

grant usage on schema public, extensions to anon, authenticated, service_role;`;

/** Droits que Supabase accorde par défaut sur le schéma public. */
export const GRANTS = `
grant usage on schema public to anon, authenticated, service_role;

-- **Des droits par défaut, posés avant les migrations**, et non un
-- \`grant all on all\` passé après coup. La différence n'est pas cosmétique :
-- plusieurs migrations révoquent explicitement l'exécution d'une fonction
-- dangereuse — \`purger_prospects_inactifs()\` supprime des comptes,
-- \`effacer_personne()\` aussi. Un \`grant all\` appliqué ensuite rendait ces
-- révocations sans effet, et les deux tests qui les vérifient échouaient sur
-- PGlite alors qu'ils passent en CI, où Supabase pose ses droits par défaut
-- avant que la première migration ne tourne.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;`;

/**
 * Applique le préambule, les migrations et le seed sur une base PGlite.
 *
 * `journal` reçoit une ligne par fichier ; le passer à `null` rend l'opération
 * silencieuse, ce dont le rejeu pgTAP a besoin — sa sortie, elle, doit rester
 * lisible d'un coup d'œil.
 */
export async function preparerBase(db, journal = console.log) {
  const dire = (texte) => journal && journal(texte);

  await db.exec(PREAMBULE);
  await db.exec(GRANTS);

  const fichiers = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

  for (const fichier of fichiers) {
    // pgTAP n'est pas embarqué dans PGlite. La suite pgTAP tourne en CI.
    if (fichier.includes('pgtap')) {
      dire(`  – ${fichier} (ignorée hors Docker)`);
      continue;
    }

    // Les extensions Supabase ne sont pas disponibles ; le schéma n'en dépend
    // que pour gen_random_uuid(), présent nativement depuis PostgreSQL 13.
    const sql = (await readFile(join(migrationsDir, fichier), 'utf8')).replace(
      /^\s*create extension[^;]*;/gim,
      '',
    );

    try {
      await db.exec(sql);
      dire(`  ✓ ${fichier}`);
    } catch (err) {
      throw new Error(`${fichier} : ${err.message}`);
    }
  }

  try {
    await db.exec(await readFile(join(racine, 'supabase', 'seed.sql'), 'utf8'));
  } catch (err) {
    throw new Error(`seed.sql : ${err.message}`);
  }
}
