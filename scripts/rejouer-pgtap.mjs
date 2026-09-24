/**
 * Rejoue la suite pgTAP sans Docker.
 *
 * `supabase test db` demande Docker, indisponible sur le poste de développement :
 * jusqu'ici la suite pgTAP ne tournait qu'en CI, et c'est ainsi que `main` est
 * resté rouge une journée entière le 23 septembre 2026 — un test comptait le
 * catalogue en dur, une migration de données y a inséré neuf produits, et
 * personne ne l'a vu avant d'aller lire les journaux GitHub.
 *
 * Ce script applique le schéma sur PGlite, avec le même environnement
 * reconstitué que `verifier-schema.mjs`, puis exécute les fichiers de
 * `supabase/tests/` en remplaçant les fonctions de pgTAP par des doublures.
 *
 * ── Ce qu'il ne remplace pas ────────────────────────────────────────────────
 *
 * **La CI reste la référence.** Les doublures sont fidèles sur ce que la suite
 * utilise réellement — neuf fonctions —, pas sur pgTAP. Elles ne reproduisent
 * ni ses diagnostics ni ses dizaines d'autres assertions, et PGlite n'est pas
 * l'image PostgreSQL de Supabase : il n'a ni GoTrue, ni PostgREST, ni les
 * extensions. Un fichier qui passe ici peut donc encore échouer là-bas.
 *
 * **`lives_ok` et `throws_ok` s'exécutent avec les droits de l'appelant**, et
 * ce point ne doit jamais changer. Les passer en `security definer` les ferait
 * tourner en superutilisateur, donc hors RLS : tous les tests d'écriture
 * cloisonnée passeraient, et ne prouveraient plus rien.
 *
 *   node scripts/rejouer-pgtap.mjs [fichier…]
 */

import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { preparerBase, racine } from './environnement-pglite.mjs';

const testsDir = join(racine, 'supabase', 'tests');

/**
 * Les doublures. Elles enregistrent chaque assertion dans `tap.resultats` au
 * lieu d'émettre une ligne TAP, ce qui permet de les relire après coup : un
 * fichier de test tourne dans une transaction qu'il annule à la fin.
 */
const DOUBLURES = `
create schema if not exists tap;
create table tap.resultats (n serial, ok boolean, description text, detail text);

-- Les assertions s'exécutent sous le rôle du test (authenticated, anon…) :
-- sans ces droits, l'enregistrement du résultat échouerait là où le test, lui,
-- est parfaitement valide.
grant usage on schema tap to public;
grant insert, select, truncate on tap.resultats to public;
grant usage, select on all sequences in schema tap to public;

create or replace function public.plan(n int) returns text
language sql as $f$ select '1..' || n $f$;

create or replace function public.finish() returns setof text
language sql as $f$ select '# fin' $f$;

create or replace function public.is(a anyelement, b anyelement, d text)
returns text language plpgsql as $f$
declare v boolean := a is not distinct from b;
begin
  insert into tap.resultats (ok, description, detail)
  values (v, d, case when v then null else format('obtenu %s, attendu %s', a, b) end);
  return 'ok';
end $f$;

create or replace function public.isnt(a anyelement, b anyelement, d text)
returns text language plpgsql as $f$
declare v boolean := a is distinct from b;
begin
  insert into tap.resultats (ok, description, detail)
  values (v, d, case when v then null else format('les deux valent %s', a) end);
  return 'ok';
end $f$;

create or replace function public.ok(v boolean, d text)
returns text language plpgsql as $f$
begin
  insert into tap.resultats (ok, description) values (coalesce(v, false), d);
  return 'ok';
end $f$;

create or replace function public.cmp_ok(a anyelement, op text, b anyelement, d text)
returns text language plpgsql as $f$
declare v boolean;
begin
  execute format('select $1 %s $2', op) into v using a, b;
  insert into tap.resultats (ok, description, detail)
  values (coalesce(v, false), d,
          case when v then null else format('%s %s %s est faux', a, op, b) end);
  return 'ok';
end $f$;

create or replace function public.matches(a text, motif text, d text)
returns text language plpgsql as $f$
declare v boolean := a ~ motif;
begin
  insert into tap.resultats (ok, description, detail)
  values (coalesce(v, false), d,
          case when v then null else format('%s ne correspond pas à %s', a, motif) end);
  return 'ok';
end $f$;

create or replace function public.lives_ok(q text, d text)
returns text language plpgsql as $f$
begin
  execute q;
  insert into tap.resultats (ok, description) values (true, d);
  return 'ok';
exception when others then
  insert into tap.resultats (ok, description, detail) values (false, d, sqlerrm);
  return 'ok';
end $f$;

-- \`code\` nul veut dire « n'importe quelle erreur fait l'affaire », et la suite
-- s'en sert : qu'une facture émise refuse d'être supprimée importe, le code
-- SQLSTATE que le déclencheur choisit pour le dire, non.
create or replace function public.throws_ok(q text, code text, msg text, d text)
returns text language plpgsql as $f$
begin
  execute q;
  insert into tap.resultats (ok, description, detail)
  values (false, d, 'aucune erreur levée');
  return 'ok';
exception when others then
  insert into tap.resultats (ok, description, detail)
  values (
    code is null or sqlstate = code,
    d,
    case when code is null or sqlstate = code then null
         else format('sqlstate %s, attendu %s', sqlstate, code) end
  );
  return 'ok';
end $f$;
`;

/** Les fonctions de pgTAP que ce script sait rejouer. */
const DOUBLEES = new Set([
  'plan',
  'finish',
  'is',
  'isnt',
  'ok',
  'cmp_ok',
  'matches',
  'lives_ok',
  'throws_ok',
]);

/**
 * Le vocabulaire de pgTAP, pour reconnaître une assertion qu'on ne double pas.
 * Sans ce garde-fou, elle passerait pour une fonction absente, donc pour un
 * test cassé — et on corrigerait le test plutôt que ce script.
 */
const PREFIXES_PGTAP =
  /^(is|isnt|isa|ok|cmp_ok|matches|imatches|alike|unalike|lives|throws|performs|has_|hasnt_|col_|table_|schema_|function_|policy|results_|bag_|set_|row_|diag|pass|fail|todo|skip|plan|finish|no_plan|done_testing)/;

function assertionsNonDoublees(sql) {
  const appelees = [...sql.matchAll(/^select\s+([a-z_]+)\s*\(/gim)].map((m) => m[1]);
  return [...new Set(appelees)].filter((f) => PREFIXES_PGTAP.test(f) && !DOUBLEES.has(f));
}

const db = new PGlite();

try {
  await preparerBase(db, null);
} catch (err) {
  console.error(`\nLe schéma ne s'applique pas : ${err.message}\n`);
  process.exit(1);
}

await db.exec(DOUBLURES);

const demandes = process.argv.slice(2);
const fichiers = demandes.length
  ? demandes
  : (await readdir(testsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => join(testsDir, f));

let total = 0;
let echecs = 0;

console.log('\nRejeu de la suite pgTAP sur PGlite — la CI reste la référence\n');

for (const fichier of fichiers) {
  const nom = fichier.split(/[\\/]/).pop();
  const brut = (await readFile(fichier, 'utf8')).trimEnd();

  const nonDoublees = assertionsNonDoublees(brut);
  if (nonDoublees.length) {
    echecs += 1;
    console.log(`  ✗ ${nom} — assertions non doublées : ${nonDoublees.join(', ')}`);
    continue;
  }

  // Le fichier se termine par `rollback;`, qui emporterait aussi les lignes de
  // résultats : elles vivent dans la même transaction. On l'ôte et on annule
  // nous-mêmes, après lecture.
  const sql = brut.endsWith('rollback;') ? brut.slice(0, -'rollback;'.length) : brut;

  await db.exec('truncate tap.resultats;');

  try {
    await db.exec(sql);
    await db.exec('reset role;');
  } catch (err) {
    await db.exec('rollback;').catch(() => {});
    echecs += 1;
    console.log(`  ✗ ${nom} — erreur SQL : ${err.message}`);
    continue;
  }

  const resultats = (await db.query('select ok, description, detail from tap.resultats order by n'))
    .rows;
  await db.exec('rollback;');

  const rates = resultats.filter((r) => !r.ok);
  total += resultats.length;
  echecs += rates.length;

  console.log(
    `  ${rates.length ? '✗' : '✓'} ${nom} — ${resultats.length} assertions, ${rates.length} échec(s)`,
  );
  for (const r of rates) {
    console.log(`      ✗ ${r.description}`);
    if (r.detail) console.log(`          ${r.detail}`);
  }
}

console.log(`\n${total} assertions rejouées, ${echecs} en échec\n`);
process.exit(echecs ? 1 : 0);
