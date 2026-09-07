/**
 * Vérification du schéma sans Docker.
 *
 * Le poste de développement est derrière un proxy dentreprise qui bloque Docker
 * Desktop : `supabase start` nest pas disponible en local. Ce script applique les
 * migrations et le seed sur un PostgreSQL réel compilé en WebAssembly (PGlite),
 * puis rejoue les invariants de cloisonnement.
 *
 * Ce quil valide  : syntaxe DDL, contraintes, triggers, fonctions, et le
 *                     comportement effectif des politiques RLS.
 * Ce quil ne valide pas : GoTrue, PostgREST, le Storage, les extensions Supabase.
 *                     La suite pgTAP de supabase/tests/ reste la référence et
 *                     tourne en CI, où Docker est disponible.
 *
 *   node scripts/verifier-schema.mjs
 */

import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(racine, 'supabase', 'migrations');

/**
 * Reconstitue le strict minimum de lenvironnement Supabase dont dépendent les
 * migrations : le schéma auth, les rôles anon/authenticated, et auth.uid().
 */
const PREAMBULE = `
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
  updated_at timestamptz
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
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

-- pgcrypto nest pas embarqué dans PGlite ; le seed ne sen sert que pour
-- fabriquer un mot de passe de test, un substitut inerte suffit.
create or replace function extensions.crypt(text, text) returns text
language sql immutable as $$ select md5($1 || $2) $$;
create or replace function extensions.gen_salt(text) returns text
language sql volatile as $$ select 'stub-salt' $$;

grant usage on schema public, extensions to anon, authenticated, service_role;
`;

/** Droits que Supabase accorde par défaut sur le schéma public. */
const GRANTS = `
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
`;

const db = new PGlite();

let echecs = 0;
let reussites = 0;

function verifier(description, obtenu, attendu) {
  const ok = obtenu === attendu;
  if (ok) {
    reussites += 1;
    console.log(`  ✓ ${description}`);
  } else {
    echecs += 1;
    console.log(`  ✗ ${description}`);
    console.log(`      attendu : ${attendu}, obtenu : ${obtenu}`);
  }
}

async function compter(requete) {
  const res = await db.query(`select count(*)::int as n from ${requete}`);
  return res.rows[0].n;
}

/** Prend lidentité dun utilisateur du seed, comme le ferait PostgREST. */
async function devenir(uid, role = 'authenticated') {
  await db.exec('reset role;');
  await db.exec(`set request.jwt.claims = '${JSON.stringify({ sub: uid, role })}';`);
  await db.exec(`set role ${role};`);
}

async function enTantQuAdministrateur() {
  await db.exec('reset role;');
  await db.exec(`set request.jwt.claims = '';`);
}

async function main() {
  console.log('\nApplication du schéma sur PostgreSQL (PGlite)\n');

  await db.exec(PREAMBULE);

  const fichiers = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

  for (const fichier of fichiers) {
    // pgTAP nest pas embarqué dans PGlite. La suite pgTAP tourne en CI.
    if (fichier.includes('pgtap')) {
      console.log(`  – ${fichier} (ignorée hors Docker)`);
      continue;
    }

    let sql = await readFile(join(migrationsDir, fichier), 'utf8');
    // Les extensions Supabase ne sont pas disponibles ; le schéma nen dépend
    // que pour gen_random_uuid(), présent nativement depuis PostgreSQL 13.
    sql = sql.replace(/^\s*create extension[^;]*;/gim, '');

    try {
      await db.exec(sql);
      console.log(`  ✓ ${fichier}`);
    } catch (err) {
      console.error(`  ✗ ${fichier}`);
      console.error(`      ${err.message}`);
      process.exit(1);
    }
  }

  await db.exec(GRANTS);

  console.log('\nChargement du jeu de données\n');
  try {
    const seed = await readFile(join(racine, 'supabase', 'seed.sql'), 'utf8');
    await db.exec(seed);
    console.log('  ✓ seed.sql');
  } catch (err) {
    console.error(`  ✗ seed.sql\n      ${err.message}`);
    process.exit(1);
  }

  // ── Invariant 1 : un coach ne voit que sa cohorte ────────────────────────
  console.log('\nCoach A — cloisonnement entre cohortes\n');
  await devenir('33333333-3333-3333-3333-333333333333');

  verifier('ne voit que linscription de sa cohorte', await compter('public.inscriptions'), 1);
  verifier('ne voit que sa cohorte', await compter('public.cohortes'), 1);
  verifier('ne voit que ses sessions', await compter('public.sessions'), 2);
  verifier('ne voit que les replays de ses sessions', await compter('public.replays'), 2);
  verifier('ne voit que ses notes de suivi', await compter('public.suivi_notes'), 2);
  verifier(
    'ne voit pas le profil du client de lautre coach',
    await compter(`public.profiles where id = '77777777-7777-7777-7777-777777777777'`),
    0,
  );

  // ── Invariant 2 : largent est fermé aux coachs ───────────────────────────
  console.log('\nCoach A — fermeture des données financières\n');
  verifier('aucune commande', await compter('public.orders'), 0);
  verifier('aucun paiement', await compter('public.payments'), 0);
  verifier('aucune échéance', await compter('public.payment_schedules'), 0);
  verifier('aucune facture', await compter('public.invoices'), 0);
  verifier('aucun lead', await compter('public.leads'), 0);

  // ── Invariant 3 : le client ne voit que ses données ──────────────────────
  console.log('\nClient A — périmètre personnel\n');
  await devenir('66666666-6666-6666-6666-666666666666');

  verifier('une seule inscription', await compter('public.inscriptions'), 1);
  verifier('une seule commande', await compter('public.orders'), 1);
  verifier('une seule facture', await compter('public.invoices'), 1);
  verifier('une seule présence', await compter('public.presences'), 1);
  verifier('seulement la note rendue visible', await compter('public.suivi_notes'), 1);
  verifier(
    'la note interne du coach ne remonte pas',
    await compter('public.suivi_notes where not visible_client'),
    0,
  );
  verifier('seulement le replay publié de sa cohorte', await compter('public.replays'), 1);
  verifier('aucun lead', await compter('public.leads'), 0);
  verifier('aucun journal daudit', await compter('public.audit_logs'), 0);
  verifier('payment_events inaccessible', await compter('public.payment_events'), 0);

  console.log('\nClient B — échéancier\n');
  await devenir('77777777-7777-7777-7777-777777777777');
  verifier('voit ses trois échéances', await compter('public.payment_schedules'), 3);
  verifier('aucune note de suivi du client A', await compter('public.suivi_notes'), 0);

  // ── Invariant 4 : visiteur anonyme ───────────────────────────────────────
  console.log('\nVisiteur anonyme\n');
  await db.exec('reset role;');
  await db.exec(`set request.jwt.claims = '';`);
  await db.exec('set role anon;');
  verifier('voit les deux offres actives', await compter('public.offres'), 2);
  verifier('ne voit pas loffre en brouillon', await compter(`public.offres where not actif`), 0);
  verifier('aucune inscription', await compter('public.inscriptions'), 0);

  // ── Invariant 5 : admin et owner ─────────────────────────────────────────
  console.log('\nAdmin et owner\n');
  await devenir('22222222-2222-2222-2222-222222222222');
  verifier('admin voit les deux inscriptions', await compter('public.inscriptions'), 2);
  verifier('admin voit les deux commandes', await compter('public.orders'), 2);
  verifier('admin ne lit pas le journal daudit', await compter('public.audit_logs'), 0);

  await devenir('11111111-1111-1111-1111-111111111111');
  const auditOwner = await compter('public.audit_logs');
  verifier('owner lit le journal daudit', auditOwner > 0, true);

  // ── Invariant 6 : garanties dintégrité ───────────────────────────────────
  console.log('\nIntégrité\n');
  await enTantQuAdministrateur();

  await db.exec(`insert into public.payment_events (provider, provider_event_id, type)
                 values ('stripe', 'evt_verif', 'checkout.session.completed');`);
  let rejoue = false;
  try {
    await db.exec(`insert into public.payment_events (provider, provider_event_id, type)
                   values ('stripe', 'evt_verif', 'checkout.session.completed');`);
  } catch {
    rejoue = true;
  }
  verifier('un webhook rejoué est rejeté par la contrainte dunicité', rejoue, true);

  const numero = (await db.query(`select numero from public.invoices limit 1`)).rows[0].numero;
  verifier('numéro de facture au format AAAA-NNNNNN', /^\d{4}-\d{6}$/.test(numero), true);

  let sourceVerrouillee = false;
  try {
    await db.exec(`update public.leads set source = 'direct' where source = 'instagram';`);
  } catch {
    sourceVerrouillee = true;
  }
  verifier('la source dun lead ne peut pas être réécrite', sourceVerrouillee, true);

  let factureImmuable = false;
  try {
    await db.exec(`delete from public.invoices;`);
  } catch {
    factureImmuable = true;
  }
  verifier('une facture émise ne peut pas être supprimée', factureImmuable, true);

  let doubleInscription = false;
  try {
    await db.exec(`insert into public.inscriptions (user_id, offre_id, cohorte_id)
                   values ('66666666-6666-6666-6666-666666666666',
                           'a0000000-0000-0000-0000-000000000001',
                           'c0000000-0000-0000-0000-00000000000a');`);
  } catch {
    doubleInscription = true;
  }
  verifier('pas de double inscription à la même cohorte', doubleInscription, true);

  // ── Filet : aucune table sans RLS ────────────────────────────────────────
  console.log('\nCouverture RLS\n');
  const sansRls = await db.query(`
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename not in (
        select c.relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relrowsecurity
      )
  `);
  verifier(
    `aucune table du schéma public sans RLS${
      sansRls.rows.length ? ` (${sansRls.rows.map((r) => r.tablename).join(', ')})` : ''
    }`,
    sansRls.rows.length,
    0,
  );

  console.log(`\n${reussites} vérifications passées, ${echecs} en échec\n`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
