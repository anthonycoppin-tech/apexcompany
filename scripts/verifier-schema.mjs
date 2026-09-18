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
 * Toute règle vérifiée ici doit AUSSI exister en pgTAP, et réciproquement : les
 * deux se maintiennent ensemble.
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

  // ── Invariant 1 : un formateur ne voit que ses affectations ──────────────
  // Révision 3 : lancrage nest plus la cohorte mais laffectation explicite,
  // inscriptions.formateur_id et leads.assigned_to. Lénoncé change, pas
  // linvariant.
  console.log('\nFormateur A — cloisonnement entre affectations\n');
  await devenir('33333333-3333-3333-3333-333333333333');

  verifier(
    'ne voit que linscription qui lui est affectée',
    await compter('public.inscriptions'),
    1,
  );
  verifier(
    'ne voit pas linscription affectée au formateur B',
    await compter(`public.inscriptions where id = 'e0000000-0000-0000-0000-00000000000b'`),
    0,
  );
  verifier('ne voit que ses deux prospects', await compter('public.leads'), 2);
  verifier(
    'ne voit pas les prospects du formateur B',
    await compter(`public.leads where assigned_to = '44444444-4444-4444-4444-444444444444'`),
    0,
  );
  verifier('ne voit que le formulaire de ses prospects', await compter('public.lead_events'), 2);
  verifier('ne voit que son audit', await compter('public.appointments'), 1);
  verifier('ne voit que sa proposition', await compter('public.propositions'), 1);
  verifier('ne voit que ses notes de suivi', await compter('public.suivi_notes'), 2);
  verifier(
    'ne voit pas la note interne du formateur B',
    await compter(
      `public.suivi_notes where inscription_id = 'e0000000-0000-0000-0000-00000000000b'`,
    ),
    0,
  );
  verifier(
    'ne voit pas le profil du client de lautre formateur',
    await compter(`public.profiles where id = '77777777-7777-7777-7777-777777777777'`),
    0,
  );
  verifier(
    'voit bien le profil de son propre client',
    await compter(`public.profiles where id = '66666666-6666-6666-6666-666666666666'`),
    1,
  );

  // ── Invariant 2 : largent est fermé aux formateurs ───────────────────────
  console.log('\nFormateur A — fermeture des données financières\n');
  verifier('aucune commande', await compter('public.orders'), 0);
  verifier('aucun paiement', await compter('public.payments'), 0);
  verifier('aucune facture', await compter('public.invoices'), 0);
  verifier('aucun abonnement', await compter('public.subscriptions'), 0);

  // ── Invariant 3 : le client ne voit que ses données ──────────────────────
  console.log('\nClient A — périmètre personnel\n');
  await devenir('66666666-6666-6666-6666-666666666666');

  verifier('une seule inscription', await compter('public.inscriptions'), 1);
  verifier('une seule commande', await compter('public.orders'), 1);
  verifier('une seule facture', await compter('public.invoices'), 1);
  verifier('sa proposition', await compter('public.propositions'), 1);
  verifier('seulement la note rendue visible', await compter('public.suivi_notes'), 1);
  verifier(
    'la note interne du formateur ne remonte pas',
    await compter('public.suivi_notes where not visible_client'),
    0,
  );
  verifier('aucun lead', await compter('public.leads'), 0);
  verifier('aucun journal daudit', await compter('public.audit_logs'), 0);
  verifier('payment_events inaccessible', await compter('public.payment_events'), 0);

  // Ces deux-là manquaient : la matrice daccès donne au client la lecture de
  // ses rendez-vous, aucune politique ne la permettait, et lécran aurait
  // affiché une liste vide sans erreur.
  verifier('voit son audit', await compter('public.appointments'), 1);
  verifier(
    'ne voit pas laudit dun autre',
    await compter(`public.appointments where cal_booking_id = 'cal_seed_b'`),
    0,
  );

  console.log('\nClient B — abonnement\n');
  await devenir('77777777-7777-7777-7777-777777777777');
  verifier('voit son abonnement', await compter('public.subscriptions'), 1);
  verifier(
    'ne voit pas labonnement dun autre',
    await compter(`public.subscriptions where user_id <> '77777777-7777-7777-7777-777777777777'`),
    0,
  );
  verifier('aucune note de suivi du client A', await compter('public.suivi_notes'), 0);

  // ── Invariant 4 : visiteur anonyme ───────────────────────────────────────
  console.log('\nVisiteur anonyme\n');
  await db.exec('reset role;');
  await db.exec(`set request.jwt.claims = '';`);
  await db.exec('set role anon;');
  verifier('voit les trois formations actives', await compter('public.formations'), 3);
  verifier(
    'ne voit pas la formation en brouillon',
    await compter(`public.formations where not actif`),
    0,
  );
  verifier('aucune inscription', await compter('public.inscriptions'), 0);
  verifier('aucune proposition', await compter('public.propositions'), 0);

  // Le contenu éditorial est le seul endroit où du brouillon côtoie du publié
  // dans la même table et sur la même page. Un témoignage recueilli mais pas
  // encore autorisé qui fuiterait ici, c'est une citation publiée sans accord.
  verifier('ne voit que le témoignage publié', await compter('public.temoignages'), 1);
  verifier('ne voit que la fiche formateur publiée', await compter('public.formateurs_fiches'), 1);

  // ── Invariant 5 : admin et owner ─────────────────────────────────────────
  console.log('\nAdmin et owner\n');
  await devenir('22222222-2222-2222-2222-222222222222');
  verifier('admin voit les deux inscriptions', await compter('public.inscriptions'), 2);
  verifier('admin voit les deux commandes', await compter('public.orders'), 2);
  verifier('admin voit les deux propositions', await compter('public.propositions'), 2);
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

  // Le filet contre le webhook rejoué, version révision 3 : lunicité porte sur
  // (user_id, formation_id) restreinte aux inscriptions actives.
  let doubleInscription = false;
  try {
    await db.exec(`insert into public.inscriptions (user_id, formation_id, statut)
                   values ('66666666-6666-6666-6666-666666666666',
                           'a0000000-0000-0000-0000-000000000002',
                           'active');`);
  } catch {
    doubleInscription = true;
  }
  verifier('pas de deuxième inscription active à la même formation', doubleInscription, true);

  // ... mais un accompagnement terminé peut être racheté. Sans ça, un client
  // fidèle serait bloqué par le filet censé le protéger.
  let readhesion = true;
  try {
    await db.exec(`insert into public.inscriptions (user_id, formation_id, statut)
                   values ('66666666-6666-6666-6666-666666666666',
                           'a0000000-0000-0000-0000-000000000002',
                           'terminee');`);
  } catch {
    readhesion = false;
  }
  verifier('une inscription terminée nempêche pas den reprendre une', readhesion, true);

  // Publier la citation dune personne sans son accord nest pas une erreur
  // dinterface : cest un traitement de données personnelles. La contrainte
  // refuse, pour quon nait pas à compter sur la vigilance de qui saisit.
  let publicationSansAccord = false;
  try {
    await db.exec(`insert into public.temoignages (auteur, contenu, consentement, publie)
                   values ('Sans accord', 'Ne doit pas passer.', false, true);`);
  } catch {
    publicationSansAccord = true;
  }
  verifier('un témoignage sans consentement ne peut pas être publié', publicationSansAccord, true);

  let publicationAvecAccord = true;
  try {
    await db.exec(`insert into public.temoignages (auteur, contenu, consentement, publie)
                   values ('Avec accord', 'Doit passer.', true, true);`);
  } catch {
    publicationAvecAccord = false;
  }
  verifier('le consentement obtenu lève le verrou', publicationAvecAccord, true);

  // La suppression du contenu publié doit laisser une trace. Un témoignage
  // porte le nom dune personne réelle et ses mots : leffacer effaçait aussi la
  // seule preuve de son accord — celle quon veut produire le jour où elle
  // conteste, cest-à-dire le jour où la ligne nexiste plus.
  await db.exec(`delete from public.temoignages where auteur = 'Avec accord';`);
  verifier(
    'la suppression dun témoignage est tracée',
    await compter(`public.audit_logs where table_cible = 'temoignages' and action = 'DELETE'`),
    1,
  );

  const traceSuppression = (
    await db.query(`select avant from public.audit_logs
                    where table_cible = 'temoignages' and action = 'DELETE' limit 1`)
  ).rows[0]?.avant;
  verifier(
    'la trace garde lenregistrement supprimé, consentement compris',
    traceSuppression?.consentement,
    true,
  );

  // Les trois tables de contenu publié partageaient le même trou dorigine :
  // leurs déclencheurs ne couvraient que la modification. Vérifier la
  // déclaration les couvre toutes les trois sans avoir à contourner les clés
  // étrangères du catalogue, quune suppression réelle de formations heurterait.
  verifier(
    'les trois déclencheurs daudit du contenu publié couvrent la suppression',
    await compter(`information_schema.triggers
                   where trigger_name in
                     ('audit_temoignages', 'audit_formateurs_fiches', 'audit_formations')
                     and event_manipulation = 'DELETE'`),
    3,
  );

  // La cohérence du type de produit, écrite en contrainte plutôt quen usage.
  let dureeIncoherente = false;
  try {
    await db.exec(`insert into public.formations (slug, titre, prix_cents, type_produit, modalite, duree_acces_jours)
                   values ('test-incoherent', 'Test', 1000, 'formation', 'groupe', 30);`);
  } catch {
    dureeIncoherente = true;
  }
  verifier('une formation à accès illimité ne peut pas porter une durée', dureeIncoherente, true);

  // Lidempotence vaut aussi pour labonnement : un renouvellement rejoué ne
  // doit pas offrir deux mois daccès.
  let doubleAbonnement = false;
  try {
    await db.exec(`insert into public.subscriptions (user_id, formation_id, provider, provider_subscription_id)
                   values ('66666666-6666-6666-6666-666666666666',
                           'a0000000-0000-0000-0000-000000000001',
                           'stripe', 'sub_test_seed_b');`);
  } catch {
    doubleAbonnement = true;
  }
  verifier(
    'un abonnement déjà enregistré chez le prestataire nest pas dupliqué',
    doubleAbonnement,
    true,
  );

  let creneauIncoherent = false;
  try {
    await db.exec(`insert into public.appointments (cal_booking_id, debut, fin)
                   values ('cal_incoherent', now(), now() - interval '1 hour');`);
  } catch {
    creneauIncoherent = true;
  }
  verifier('un rendez-vous ne peut pas se terminer avant davoir commencé', creneauIncoherent, true);

  let accompagnementSansDuree = false;
  try {
    await db.exec(`insert into public.formations (slug, titre, prix_cents, type_produit, modalite, duree_acces_jours)
                   values ('test-accompagnement-sans-duree', 'Test', 1000, 'accompagnement', 'individuel', null);`);
  } catch {
    accompagnementSansDuree = true;
  }
  verifier('un accompagnement doit déclarer sa durée daccès', accompagnementSansDuree, true);

  // ── Le chemin de largent, rejoué ─────────────────────────────────────────
  // Cest le code le plus critique du projet : un webhook rejoué ne doit ni
  // créer deux inscriptions, ni émettre deux factures, ni offrir deux mois.
  console.log('\nTraitement dun paiement\n');

  const compteur = async () => ({
    inscriptions: await compter(
      `public.inscriptions where user_id = '66666666-6666-6666-6666-666666666666'`,
    ),
    factures: await compter('public.invoices'),
    file: await compter('public.discord_sync_queue'),
  });

  const avant = await compteur();

  const paiement = `select public.traiter_paiement(
    'stripe', 'evt_paiement_verif', 'checkout.session.completed', '{}'::jsonb,
    '66666666-6666-6666-6666-666666666666',
    'a0000000-0000-0000-0000-000000000003',
    99000, 'EUR', 'cs_verif', 'pi_verif', null, null
  ) as r;`;

  const premier = await db.query(paiement);
  const apres1 = await compteur();

  verifier('le paiement crée une inscription', apres1.inscriptions - avant.inscriptions, 1);
  verifier('le paiement émet une facture', apres1.factures - avant.factures, 1);
  verifier('le paiement empile un rôle Discord', apres1.file - avant.file, 1);
  verifier('le paiement nest pas signalé déjà traité', premier.rows[0].r.deja_traite, false);

  // Une formation est à accès illimité : la date de fin doit rester nulle,
  // sinon la révocation quotidienne finirait par couper un accès à vie.
  verifier('une formation ouvre un accès sans date de fin', premier.rows[0].r.date_fin_acces, null);

  const second = await db.query(paiement);
  const apres2 = await compteur();

  verifier('le même événement rejoué sort sans rien faire', second.rows[0].r.deja_traite, true);
  verifier('aucune deuxième inscription', apres2.inscriptions - apres1.inscriptions, 0);
  verifier('aucune deuxième facture', apres2.factures - apres1.factures, 0);
  verifier('aucun deuxième rôle empilé', apres2.file - apres1.file, 0);

  // Le client payé par proposition est confié à celui qui l'a émise : sans
  // cela, aucun formateur ne voit jamais un client réel.
  await db.exec(`
    insert into public.propositions (id, lead_id, user_id, formation_id, formateur_id,
                                     montant_cents, statut, expire_le)
    values ('f0000000-0000-0000-0000-0000000000c1', 'b0000000-0000-0000-0000-000000000004',
            '77777777-7777-7777-7777-777777777777', 'a0000000-0000-0000-0000-000000000003',
            '44444444-4444-4444-4444-444444444444', 99000, 'envoyee', now() + interval '5 days');
    insert into public.propositions (id, lead_id, user_id, formation_id, formateur_id,
                                     montant_cents, statut, expire_le)
    values ('f0000000-0000-0000-0000-0000000000c2', 'b0000000-0000-0000-0000-000000000002',
            '66666666-6666-6666-6666-666666666666', 'a0000000-0000-0000-0000-000000000002',
            '44444444-4444-4444-4444-444444444444', 249000, 'envoyee', now() + interval '5 days');
  `);
  await db.query(`select public.traiter_paiement(
    'stripe', 'evt_formateur_verif', 'checkout.session.completed', '{}'::jsonb,
    '77777777-7777-7777-7777-777777777777', 'a0000000-0000-0000-0000-000000000003',
    99000, 'EUR', 'cs_formateur_verif', 'pi_formateur_verif',
    'f0000000-0000-0000-0000-0000000000c1', null)`);
  verifier(
    'le paiement confie le client au formateur de la proposition',
    (
      await db.query(`select formateur_id from public.inscriptions
        where user_id = '77777777-7777-7777-7777-777777777777'
          and formation_id = 'a0000000-0000-0000-0000-000000000003' and statut = 'active'`)
    ).rows[0]?.formateur_id,
    '44444444-4444-4444-4444-444444444444',
  );

  // Un rachat du même accompagnement, proposé par un autre formateur, ne
  // retire pas le client à celui qui le suit déjà.
  await db.query(`select public.traiter_paiement(
    'stripe', 'evt_formateur_garde', 'checkout.session.completed', '{}'::jsonb,
    '66666666-6666-6666-6666-666666666666', 'a0000000-0000-0000-0000-000000000002',
    249000, 'EUR', 'cs_formateur_garde', 'pi_formateur_garde',
    'f0000000-0000-0000-0000-0000000000c2', null)`);
  verifier(
    'une affectation existante n’est pas écrasée',
    (
      await db.query(`select formateur_id from public.inscriptions
        where id = 'e0000000-0000-0000-0000-00000000000a'`)
    ).rows[0]?.formateur_id,
    '33333333-3333-3333-3333-333333333333',
  );
  // Le même rachat prolonge l'accès en cours au lieu de le raccourcir : le seed
  // lui laisse 81 jours, les 90 achetés s'y ajoutent.
  verifier(
    'un rachat d’accompagnement prolonge l’accès depuis sa fin actuelle',
    (
      await db.query(`select (date_fin_acces - current_date)::int as j from public.inscriptions
        where id = 'e0000000-0000-0000-0000-00000000000a'`)
    ).rows[0]?.j,
    171,
  );

  // ── La révocation en fin daccès ──────────────────────────────────────────
  console.log('\nRévocation des accès expirés\n');

  // Un produit qui partage le rôle Discord de « fondations ». Cest le cas qui
  // fait tomber une révocation raisonnée par personne : le client A garde
  // fondations, il ne doit donc pas perdre ce rôle quand celui-ci expire.
  await db.exec(`
    insert into public.formations (id, slug, titre, prix_cents, type_produit, modalite,
                                   duree_acces_jours, discord_role_id, actif, ordre)
    values ('a0000000-0000-0000-0000-000000000005', 'duo-test', 'Produit au rôle partagé',
            10000, 'accompagnement', 'individuel', 30, '900000000000000003', false, 9);

    insert into public.inscriptions (user_id, formation_id, statut, date_debut, date_fin_acces)
    values ('66666666-6666-6666-6666-666666666666',
            'a0000000-0000-0000-0000-000000000005',
            'active', current_date - 40, current_date - 1);

    update public.inscriptions set date_fin_acces = current_date - 1
    where id = 'e0000000-0000-0000-0000-00000000000b';
  `);

  const fileAvant = await compter('public.discord_sync_queue');
  const revocation = (await db.query('select public.revoquer_acces_expires() as r')).rows[0].r;
  const fileApres = await compter('public.discord_sync_queue');

  verifier('deux inscriptions échues sont terminées', revocation.inscriptions_terminees, 2);
  verifier('un seul rôle est réellement retiré', revocation.roles_revoques, 1);
  verifier(
    'le rôle détenu par une autre inscription active est conservé',
    revocation.roles_conserves,
    1,
  );
  verifier('un seul revoke est empilé', fileApres - fileAvant, 1);

  // Linvariant central : une date de fin nulle nest jamais sélectionnée. Cest
  // ce qui donne aux formations leur accès à vie, sans cas particulier.
  verifier(
    'laccès illimité nest pas révoqué',
    await compter(
      `public.inscriptions where formation_id = 'a0000000-0000-0000-0000-000000000003' and statut = 'active'
        and user_id = '66666666-6666-6666-6666-666666666666'`,
    ),
    1,
  );

  verifier(
    'labonnement suit son inscription',
    await compter(`public.subscriptions where statut = 'terminee'`),
    1,
  );

  // Deuxième passage : plus rien à faire, et surtout pas un second revoke.
  const seconde = (await db.query('select public.revoquer_acces_expires() as r')).rows[0].r;
  verifier('un second passage ne retrouve rien', seconde.inscriptions_terminees, 0);
  verifier(
    'et nempile aucun revoke de plus',
    (await compter('public.discord_sync_queue')) - fileApres,
    0,
  );

  // ── Le remboursement, rejoué ─────────────────────────────────────────────
  // De largent qui sort : le seul risque qui compte est de le faire deux fois.
  console.log('\nTraitement dun remboursement\n');

  const paiementARembourser = (
    await db.query(
      `select id from public.payments where provider_payment_id = 'pi_test_seed_a' limit 1`,
    )
  ).rows[0].id;

  const remboursement = (
    await db.query(`insert into public.refunds (payment_id, montant_cents, motif, statut)
                    values ('${paiementARembourser}', 50000, 'Vérification', 'approuve')
                    returning id`)
  ).rows[0].id;

  const fileAvantR = await compter('public.discord_sync_queue');

  const premierR = (
    await db.query(
      `select public.enregistrer_remboursement('${remboursement}', 're_verif', null) as r`,
    )
  ).rows[0].r;

  verifier('le remboursement est enregistré', premierR.deja_traite, false);
  verifier(
    'linscription correspondante passe en remboursee',
    await compter(`public.inscriptions where statut = 'remboursee'`),
    1,
  );
  verifier(
    'la commande passe en remboursee',
    await compter(`public.orders where statut = 'remboursee'`),
    1,
  );
  verifier(
    'le rôle est retiré par la file',
    (await compter(`public.discord_sync_queue where action = 'revoke'`)) > 0,
    true,
  );

  const secondR = (
    await db.query(
      `select public.enregistrer_remboursement('${remboursement}', 're_verif', null) as r`,
    )
  ).rows[0].r;

  verifier('un remboursement rejoué sort sans rien faire', secondR.deja_traite, true);
  verifier(
    'et nempile aucun revoke de plus',
    (await compter('public.discord_sync_queue')) - fileAvantR,
    1,
  );

  let remboursementImmuable = false;
  try {
    await db.exec(`delete from public.refunds where id = '${remboursement}';`);
  } catch {
    remboursementImmuable = true;
  }
  verifier('un remboursement ne peut pas être supprimé', remboursementImmuable, true);

  // ── Ce que Stripe décide sans nous ───────────────────────────────────────
  console.log('\nLitiges et remboursements venus du prestataire\n');

  const litige = (evt, statut) =>
    db.query(`select public.enregistrer_litige(
      'stripe', '${evt}', 'charge.dispute.updated', '{}'::jsonb, 'du_verif',
      array['ch_inconnu', 'pi_test_seed_b'], 4900, '${statut}', 'fraudulent',
      now() + interval '7 days') as r`);

  await litige('evt_du_1', 'ouvert');
  verifier('un litige Stripe est enregistré', await compter(`public.disputes`), 1);
  verifier(
    'un litige rejoué sort sans rien faire',
    (await litige('evt_du_1', 'ouvert')).rows[0].r.deja_traite,
    true,
  );
  await litige('evt_du_2', 'gagne');
  await litige('evt_du_3', 'ouvert');
  verifier(
    'un événement en retard ne rouvre pas un litige clos',
    (await db.query(`select statut from public.disputes where provider_dispute_id = 'du_verif'`))
      .rows[0].statut,
    'gagne',
  );
  const litigeInconnu = (
    await db.query(`select public.enregistrer_litige(
      'stripe', 'evt_du_4', 'charge.dispute.created', '{}'::jsonb, 'du_orphelin',
      array['pi_inconnu'], 100, 'ouvert', null, null) as r`)
  ).rows[0].r;
  verifier(
    'un litige sur un paiement inconnu est consigné, pas inventé',
    litigeInconnu.paiement_introuvable === true && (await compter('public.disputes')) === 1,
    true,
  );

  const rembourserChezStripe = (evt, re, montant) =>
    db.query(`select public.enregistrer_remboursement_prestataire(
      'stripe', '${evt}', 'refund.created', '{}'::jsonb, '${re}',
      array['pi_test_seed_b'], ${montant}) as r`);
  const inscriptionB = `public.inscriptions
    where order_id = 'd0000000-0000-0000-0000-00000000000b' and statut = 'active'`;

  // Le test de révocation plus haut a terminé cette inscription : on la rouvre.
  await db.exec(`update public.inscriptions set statut = 'active', date_fin_acces = current_date + 23
    where id = 'e0000000-0000-0000-0000-00000000000b';`);

  // Le renouvellement mensuel enregistre ce qu'il encaisse — il ne le faisait pas.
  const renouveler = (evt, ref) =>
    db.query(`select public.renouveler_abonnement(
      'stripe', '${evt}', 'invoice.paid', '{}'::jsonb, 'sub_test_seed_b', 4900, '${ref}') as r`);
  const paiementsB = `public.payments where order_id = 'd0000000-0000-0000-0000-00000000000b'`;
  const facturesB = `public.invoices where order_id = 'd0000000-0000-0000-0000-00000000000b'`;
  const facturesAvant = await compter(facturesB);
  await renouveler('evt_renouv_1', 'in_renouv_1');
  verifier('un renouvellement enregistre son encaissement', await compter(paiementsB), 2);
  verifier('et émet sa facture', (await compter(facturesB)) - facturesAvant, 1);
  verifier(
    'un renouvellement rejoué nencaisse rien de plus',
    (await renouveler('evt_renouv_1', 'in_renouv_1')).rows[0].r.deja_traite === true &&
      (await compter(paiementsB)) === 2,
    true,
  );

  const partiel = (await rembourserChezStripe('evt_re_1', 're_partiel', 1000)).rows[0].r;
  verifier(
    'un remboursement partiel fait chez Stripe est enregistré sans fermer laccès',
    partiel.integral === false && (await compter(inscriptionB)) === 1,
    true,
  );
  const integral = (await rembourserChezStripe('evt_re_2', 're_reste', 3900)).rows[0].r;
  verifier(
    'le complément qui solde le paiement referme laccès',
    integral.integral === true && (await compter(inscriptionB)) === 0,
    true,
  );
  verifier(
    'un remboursement Stripe rejoué sort sans rien faire',
    (await rembourserChezStripe('evt_re_2', 're_reste', 3900)).rows[0].r.deja_traite,
    true,
  );
  verifier(
    'un remboursement du back-office annoncé par Stripe est reconnu',
    (await rembourserChezStripe('evt_re_3', 're_verif', 50000)).rows[0].r.deja_connu,
    true,
  );

  // ── Suivi commercial du formateur ────────────────────────────────────────
  console.log('\nFormateur A — suivi commercial\n');
  await devenir('33333333-3333-3333-3333-333333333333');
  verifier(
    'fait avancer le statut de son prospect',
    (
      await db.query(
        `update public.leads set statut = 'contacte'
         where id = 'b0000000-0000-0000-0000-000000000001' returning id`,
      )
    ).rows.length,
    1,
  );
  verifier(
    'ne peut pas changer le statut du prospect du formateur B',
    (
      await db.query(
        `update public.leads set statut = 'perdu'
         where id = 'b0000000-0000-0000-0000-000000000003' returning id`,
      )
    ).rows.length,
    0,
  );
  let historiqueFerme = false;
  try {
    await db.exec(
      `insert into public.lead_events (lead_id, type, payload)
       values ('b0000000-0000-0000-0000-000000000003', 'echange', '{}'::jsonb);`,
    );
  } catch {
    historiqueFerme = true;
  }
  verifier(
    'ne peut pas écrire dans l’historique d’un prospect du formateur B',
    historiqueFerme,
    true,
  );
  await enTantQuAdministrateur();
  await db.exec(
    `update public.leads set statut = 'nouveau' where id = 'b0000000-0000-0000-0000-000000000001';`,
  );

  // ── Purge des prospects inactifs ─────────────────────────────────────────
  // Le jeu d'essai vit dans le fichier pgTAP, pour n'exister qu'une fois.
  console.log('\nPurge des prospects inactifs\n');
  await enTantQuAdministrateur();

  const testPurge = await readFile(
    join(racine, 'supabase', 'tests', '05_purge_prospects.test.sql'),
    'utf8',
  );
  const debutJeu = testPurge.indexOf('create function pg_temp.vieux_compte(');
  const finJeu = testPurge.indexOf('-- ── La simulation ne supprime rien');
  if (debutJeu < 0 || finJeu < debutJeu) {
    throw new Error('Repères du jeu d’essai introuvables dans 05_purge_prospects.test.sql');
  }
  await db.exec(testPurge.slice(debutJeu, finJeu));

  const purge = async (simulation) => {
    const r = (await db.query(`select public.purger_prospects_inactifs(${simulation}) as r`))
      .rows[0].r;
    return `${r.comptes}/${r.leads}/${r.rendez_vous}/${r.consentements}`;
  };
  const existe = (table, id) => compter(`${table} where id = '${id}'`);

  verifier(
    'la simulation annonce 1 compte, 3 leads, 1 rendez-vous, 2 consentements',
    await purge(true),
    '1/3/1/2',
  );
  verifier(
    'et ne supprime rien',
    await existe('auth.users', '0e000000-0000-0000-0000-000000000001'),
    1,
  );
  verifier('la purge supprime exactement ce qui était annoncé', await purge(false), '1/3/1/2');
  verifier(
    'le compte inactif a disparu, profil compris',
    await existe('public.profiles', '0e000000-0000-0000-0000-000000000001'),
    0,
  );
  verifier(
    'ses réponses au formulaire sont parties avec lui',
    await compter(`public.lead_events where lead_id = '0f000000-0000-0000-0000-000000000001'`),
    0,
  );
  verifier(
    'connexion récente, commande annulée, formateur, rendez-vous à venir : tous gardés',
    await compter(`auth.users where id in (
      '0e000000-0000-0000-0000-000000000002', '0e000000-0000-0000-0000-000000000003',
      '0e000000-0000-0000-0000-000000000004', '0e000000-0000-0000-0000-000000000005')`),
    4,
  );
  verifier(
    'un lead gagné n’est jamais purgé',
    await existe('public.leads', '0f000000-0000-0000-0000-000000000007'),
    1,
  );
  verifier(
    'un consentement dont l’adresse appartient encore à un client est conservé',
    await compter(`public.consents where email = 'client.a@apex.test'`),
    1,
  );
  verifier(
    'la trace laissée ne contient aucune donnée personnelle',
    JSON.stringify(
      (
        await db.query(`select apres from public.audit_logs
          where action = 'PURGE' and enregistrement_id = '0e000000-0000-0000-0000-000000000001'`)
      ).rows[0]?.apres,
    ),
    '{"motif":"prospect inactif depuis trois ans"}',
  );
  verifier(
    'les prospects récents du seed sont intacts',
    await compter(`public.leads where id::text like 'b0000000-%'`),
    5,
  );
  verifier('un second passage ne trouve plus rien', await purge(false), '0/0/0/0');
  // Le droit d'exécution n'est pas vérifiable ici : GRANTS rouvre toutes les
  // fonctions à `authenticated`. Il l'est en pgTAP.

  // ── Effacement sur demande ───────────────────────────────────────────────
  // Même principe : le jeu d'essai vit dans le fichier pgTAP.
  console.log('\nEffacement d’une personne, à sa demande\n');
  await enTantQuAdministrateur();

  const testEffacement = await readFile(
    join(racine, 'supabase', 'tests', '06_effacement.test.sql'),
    'utf8',
  );
  const debutEff = testEffacement.indexOf('-- ── Jeu d');
  const finEff = testEffacement.indexOf('-- ── Les vérifications');
  if (debutEff < 0 || finEff < debutEff) {
    throw new Error('Repères du jeu d’essai introuvables dans 06_effacement.test.sql');
  }
  await db.exec(testEffacement.slice(debutEff, finEff));

  const effacer = async (lead, simulation = true) =>
    (await db.query(`select public.effacer_personne('${lead}', ${simulation}) as r`)).rows[0].r;
  const refuse = async (lead) => {
    try {
      await effacer(lead);
      return 'accepté';
    } catch (err) {
      return err.code ?? err.message;
    }
  };

  await devenir('66666666-6666-6666-6666-666666666666');
  verifier(
    'un client ne peut pas lancer un effacement',
    await refuse('b0000000-0000-0000-0000-000000000002'),
    '42501',
  );

  await devenir('22222222-2222-2222-2222-222222222222');
  verifier(
    'un prospect inconnu est signalé, pas ignoré',
    await refuse('0c000000-0000-0000-0000-0000000000ff'),
    'P0002',
  );
  const simulation = await effacer('0c000000-0000-0000-0000-000000000001');
  verifier(
    'la simulation annonce le compte, ses deux leads, son rendez-vous et ses deux consentements',
    `${simulation.possible}/${simulation.compte}/${simulation.leads}/${simulation.rendez_vous}/${simulation.consentements}`,
    'true/true/2/1/2',
  );
  verifier(
    'la simulation ne supprime rien',
    await compter(`public.leads where id = '0c000000-0000-0000-0000-000000000001'`),
    1,
  );
  verifier(
    'un client ne s’efface pas d’ici',
    (await effacer('b0000000-0000-0000-0000-000000000002')).possible,
    false,
  );
  verifier(
    'un compte de l’équipe ne s’efface pas d’ici',
    (await effacer('0c000000-0000-0000-0000-000000000003')).possible,
    false,
  );
  verifier(
    'une commande, même annulée, bloque l’effacement',
    (await effacer('0c000000-0000-0000-0000-000000000004')).possible,
    false,
  );
  verifier(
    'l’effacement réel supprime ce qui était annoncé',
    (await effacer('0c000000-0000-0000-0000-000000000001', false)).leads,
    2,
  );

  await enTantQuAdministrateur();
  verifier(
    'le compte, ses leads, son rendez-vous et ses consentements ont disparu',
    (await compter(`auth.users where id = '0d000000-0000-0000-0000-000000000001'`)) +
      (await compter(`public.leads where id in
        ('0c000000-0000-0000-0000-000000000001', '0c000000-0000-0000-0000-000000000002')`)) +
      (await compter(`public.appointments where cal_booking_id = 'cal_efface'`)) +
      (await compter(`public.consents where user_id = '0d000000-0000-0000-0000-000000000001'
        or lower(email) = 'efface.moi@example.com'`)),
    0,
  );
  verifier(
    'l’effacement laisse une trace, sans l’adresse effacée',
    JSON.stringify(
      (
        await db.query(`select apres from public.audit_logs
          where action = 'EFFACEMENT' and enregistrement_id = '0d000000-0000-0000-0000-000000000001'`)
      ).rows[0]?.apres,
    ),
    '{"leads":2,"motif":"demande de la personne"}',
  );

  // ── Registre des emails ──────────────────────────────────────────────────
  console.log('\nRegistre des emails transactionnels\n');
  await enTantQuAdministrateur();
  const reserver = `insert into public.emails_envoyes (modele, cle, user_id, destinataire)
    values ('paiement', 'd0000000-0000-0000-0000-00000000000a',
            '66666666-6666-6666-6666-666666666666', 'client.a@apex.test')`;
  await db.exec(reserver);
  let doublon = 'accepté';
  try {
    await db.exec(reserver);
  } catch (err) {
    doublon = err.code;
  }
  verifier('un même email ne se réserve qu’une fois', doublon, '23505');

  await devenir('66666666-6666-6666-6666-666666666666');
  verifier(
    'un client ne lit pas le registre, pas même ses propres lignes',
    await compter('public.emails_envoyes'),
    0,
  );
  let ecriture = 'acceptée';
  try {
    await db.exec(`insert into public.emails_envoyes (modele, cle, user_id, destinataire)
      values ('test', 'x', '66666666-6666-6666-6666-666666666666', 'x@example.com')`);
  } catch (err) {
    ecriture = err.code;
  }
  verifier('personne n’écrit dans le registre par l’API', ecriture, '42501');

  await devenir('22222222-2222-2222-2222-222222222222');
  verifier('le staff lit le registre', await compter('public.emails_envoyes'), 1);
  await enTantQuAdministrateur();

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

  // ── Filet : plus aucune trace du vocabulaire de la révision 2 ────────────
  const vestiges = await db.query(`
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in ('offres', 'cohortes', 'cohorte_coachs', 'sessions',
                        'presences', 'replays', 'coaching_sessions', 'payment_schedules')
  `);
  verifier(
    `aucune table de la révision 2 ne survit${
      vestiges.rows.length ? ` (${vestiges.rows.map((r) => r.tablename).join(', ')})` : ''
    }`,
    vestiges.rows.length,
    0,
  );

  const roleCoach = await db.query(`
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'coach'
  `);
  verifier('le rôle coach a bien été renommé formateur', roleCoach.rows.length, 0);

  console.log(`\n${reussites} vérifications passées, ${echecs} en échec\n`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
