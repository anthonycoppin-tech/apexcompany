import Link from 'next/link';

import { Pastille, Tuile, type Ton } from '@/components/admin';
import { Coordonnees } from '@/components/coordonnees';
import { Carte, LISTE } from '@/components/ui';
import { bornesDuJour, dateCourte, dateHeure, heure } from '@/lib/format';
import {
  ISSUES_RDV,
  JOUR_MS,
  SANS_SUIVI_JOURS,
  depuis,
  joursRestants,
  nomComplet,
  pourcentage,
  scoreAppel,
} from '@/lib/formateur/suivi';
import { libelle } from '@/lib/qualification/questionnaire';
import { estFormateurAdmin } from '@/lib/auth/profils';
import { getUserRoles } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';

type Tache = {
  cle: string;
  ton: Ton;
  categorie: string;
  qui: string;
  href: string;
  detail: string;
  ordre: number;
};

const SANS_NOUVELLES_JOURS = 5;
const FIN_ACCES_JOURS = 14;

/**
 * `/formateur` — ce que Franck ouvre le matin, et qui lui dit quoi faire.
 *
 * Le cœur de l'écran est une **file de tâches qui nomme des personnes**, comme
 * « Demande quelqu'un » dans le back-office : un compteur « 4 prospects à
 * rappeler » oblige à aller chercher lesquels, une ligne par personne mène
 * directement à la fiche où l'appel se consigne. Chaque tâche disparaît d'elle-
 * même quand le geste est fait — un échange consigné, une issue saisie, une
 * proposition émise. Rien à cocher à la main, donc rien à oublier de cocher.
 *
 * Toutes les requêtes passent par la RLS : ce qui s'affiche est exactement ce
 * que les politiques laissent lire. Aucun montant sur cet écran.
 *
 * Le formateur employé n'y voit pas les taux (présence, propositions sur
 * 30 jours) : ce sont des statistiques, réservées au formateur admin depuis le
 * 25 septembre 2026. Il garde ce qui sert à travailler — ses audits, ses tâches.
 */
export default async function Page() {
  const admin = estFormateurAdmin(await getUserRoles());
  const supabase = await createClient();
  const { debut, fin } = bornesDuJour();
  const maintenant = new Date().getTime();
  const iso = (ms: number) => new Date(ms).toISOString();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    moi,
    aujourdhui,
    semaine,
    leads,
    rdvPasses,
    propositions,
    evenements,
    accompagnements,
    prochain,
  ] = await Promise.all([
    user
      ? supabase.from('profiles').select('prenom').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('appointments')
      .select(
        'id, debut, statut, issue, leads(id, prenom, nom, telephone, tranche_budget, blocage, niveau_trading)',
      )
      .gte('debut', debut)
      .lt('debut', fin)
      .neq('statut', 'annule')
      .order('debut'),
    supabase
      .from('appointments')
      .select('id, debut, leads(id, prenom, nom, telephone)')
      .gte('debut', fin)
      .lt('debut', iso(maintenant + 7 * JOUR_MS))
      .neq('statut', 'annule')
      .order('debut'),
    supabase
      .from('leads')
      .select(
        'id, prenom, nom, telephone, statut, tranche_budget, delai_objectif, created_at, user_id',
      )
      .in('statut', ['nouveau', 'contacte', 'rdv', 'proposition']),
    supabase
      .from('appointments')
      .select('id, debut, issue, lead_id, leads(id, prenom, nom, statut, user_id)')
      .lt('debut', iso(maintenant))
      .gte('debut', iso(maintenant - 30 * JOUR_MS))
      .neq('statut', 'annule')
      .order('debut', { ascending: false }),
    supabase
      .from('propositions')
      .select('id, statut, expire_le, user_id, lead_id, created_at, formations(titre)')
      .gte('created_at', iso(maintenant - 30 * JOUR_MS)),
    supabase
      .from('lead_events')
      .select('lead_id, created_at')
      .eq('type', 'echange')
      .gte('created_at', iso(maintenant - 60 * JOUR_MS))
      .order('created_at', { ascending: false }),
    supabase
      .from('inscriptions')
      .select(
        'id, date_debut, date_fin_acces, user_id, formations(titre, modalite), suivi_notes(created_at)',
      )
      .eq('statut', 'active')
      .order('date_fin_acces'),
    // Le prochain audit, qu'il soit aujourd'hui ou dans dix jours : c'est lui
    // qu'on prépare, et ses coordonnées doivent être à portée de main si
    // quelque chose bouge.
    supabase
      .from('appointments')
      .select(
        'id, debut, leads(id, prenom, nom, email, telephone, tranche_budget, blocage, niveau_trading, delai_objectif, prop_firm, formations:produit_souhaite_id(titre))',
      )
      .gte('debut', iso(maintenant))
      .neq('statut', 'annule')
      .order('debut')
      .limit(1)
      .maybeSingle(),
  ]);

  const dernierEchange = new Map<string, string>();
  for (const e of evenements.data ?? []) {
    if (!dernierEchange.has(e.lead_id)) dernierEchange.set(e.lead_id, e.created_at);
  }

  const leadParCompte = new Map<
    string,
    { id: string; prenom: string | null; nom: string | null }
  >();
  const tousLeads = leads.data ?? [];
  for (const l of tousLeads) if (l.user_id) leadParCompte.set(l.user_id, l);

  const taches: Tache[] = [];

  // 1. Les issues d'audit à consigner — sans elles, les statistiques mentent.
  for (const r of rdvPasses.data ?? []) {
    if (r.issue || !r.leads) continue;
    taches.push({
      cle: `issue-${r.id}`,
      ton: 'probleme',
      categorie: 'Issue à consigner',
      qui: nomComplet(r.leads),
      href: '/formateur/rendez-vous',
      detail: `Audit du ${dateHeure(r.debut)}`,
      ordre: 0,
    });
  }

  // 2. Les propositions qui expirent bientôt — le moment de relancer.
  for (const p of propositions.data ?? []) {
    if (p.statut !== 'envoyee' || !p.expire_le) continue;
    const reste = new Date(p.expire_le).getTime() - maintenant;
    if (reste > 2 * JOUR_MS) continue;
    const lead = p.lead_id ? { id: p.lead_id } : leadParCompte.get(p.user_id);
    if (!lead) continue;
    taches.push({
      cle: `expire-${p.id}`,
      ton: 'attente',
      categorie: reste < 0 ? 'Proposition échue' : 'Proposition qui expire',
      qui: nomComplet(leadParCompte.get(p.user_id)),
      href: `/formateur/clients/${lead.id}`,
      detail: `${p.formations?.titre ?? 'Proposition'} · ${reste < 0 ? 'échue le' : 'expire le'} ${dateHeure(p.expire_le)}`,
      ordre: 1,
    });
  }

  // 3. Les audits honorés sans proposition — la vente qu'on laisse filer.
  const avecProposition = new Set((propositions.data ?? []).map((p) => p.user_id));
  const vus = new Set<string>();
  for (const r of rdvPasses.data ?? []) {
    const l = r.leads;
    if (r.issue !== 'honore' || !l || vus.has(l.id)) continue;
    vus.add(l.id);
    if (l.statut !== 'rdv' || (l.user_id && avecProposition.has(l.user_id))) continue;
    taches.push({
      cle: `proposer-${l.id}`,
      ton: 'attente',
      categorie: 'Proposition à émettre',
      qui: nomComplet(l),
      href: `/formateur/clients/${l.id}`,
      detail: `Audit honoré ${depuis(r.debut, maintenant)}`,
      ordre: 2,
    });
  }

  // 4. Les prospects à appeler, dans l'ordre où il vaut la peine de le faire.
  const aContacter = tousLeads
    .filter((l) => l.statut === 'nouveau' && !dernierEchange.has(l.id))
    .sort((a, b) => scoreAppel(b, maintenant) - scoreAppel(a, maintenant));
  for (const l of aContacter) {
    taches.push({
      cle: `appel-${l.id}`,
      ton: 'neutre',
      categorie: 'À appeler',
      qui: nomComplet(l),
      href: `/formateur/clients/${l.id}`,
      detail: [
        libelle('tranche_budget', l.tranche_budget),
        libelle('delai_objectif', l.delai_objectif),
        `arrivé ${depuis(l.created_at, maintenant)}`,
      ].join(' · '),
      ordre: 3,
    });
  }

  // 5. Les contacts restés sans suite.
  for (const l of tousLeads) {
    if (l.statut !== 'contacte') continue;
    const dernier = dernierEchange.get(l.id) ?? l.created_at;
    if (maintenant - new Date(dernier).getTime() < SANS_NOUVELLES_JOURS * JOUR_MS) continue;
    taches.push({
      cle: `relance-${l.id}`,
      ton: 'neutre',
      categorie: 'À relancer',
      qui: nomComplet(l),
      href: `/formateur/clients/${l.id}`,
      detail: `Contacté, pas d’audit réservé · dernier échange ${depuis(dernier, maintenant)}`,
      ordre: 4,
    });
  }

  // 6. Les accompagnements : ceux qui se terminent — le moment de parler de
  // la suite —, et les suivis individuels laissés sans note. Ancrés sur
  // l'inscription, pas sur la fiche prospect : le client suivi n'a pas
  // forcément été vendu par ce formateur.
  const actifs = accompagnements.data ?? [];
  const { data: personnes } = actifs.length
    ? await supabase
        .from('profiles')
        .select('id, prenom, nom, email')
        .in(
          'id',
          actifs.map((i) => i.user_id),
        )
    : {
        data: [] as Array<{ id: string; prenom: string | null; nom: string | null; email: string }>,
      };
  const personne = new Map((personnes ?? []).map((p) => [p.id, p]));

  for (const i of actifs) {
    const p = personne.get(i.user_id);
    const qui = nomComplet(p, p?.email ?? 'Client');
    const restants = joursRestants(i.date_fin_acces, maintenant);
    if (restants !== null && restants <= FIN_ACCES_JOURS) {
      taches.push({
        cle: `fin-${i.id}`,
        ton: 'neutre',
        categorie: 'Accès qui se termine',
        qui,
        href: `/formateur/accompagnements/${i.id}`,
        detail: `${i.formations?.titre ?? 'Accès'} · jusqu’au ${dateCourte(i.date_fin_acces)}`,
        ordre: 5,
      });
    }

    if (i.formations?.modalite !== 'individuel') continue;
    const derniere = (i.suivi_notes ?? [])
      .map((n) => n.created_at)
      .sort()
      .at(-1);
    if (maintenant - new Date(derniere ?? i.date_debut).getTime() <= SANS_SUIVI_JOURS * JOUR_MS) {
      continue;
    }
    taches.push({
      cle: `suivi-${i.id}`,
      ton: 'attente',
      categorie: 'Suivi à reprendre',
      qui,
      href: `/formateur/accompagnements/${i.id}`,
      detail: `${i.formations?.titre ?? 'Accompagnement'} · ${
        derniere ? `dernière note ${depuis(derniere, maintenant)}` : 'aucune note depuis le début'
      }`,
      ordre: 4,
    });
  }

  taches.sort((a, b) => a.ordre - b.ordre);

  const honores30 = (rdvPasses.data ?? []).filter((r) => r.issue === 'honore').length;
  const absents30 = (rdvPasses.data ?? []).filter((r) => r.issue === 'absent').length;
  const emises30 = propositions.data?.length ?? 0;
  const acceptees30 = propositions.data?.filter((p) => p.statut === 'acceptee').length ?? 0;
  const enCours = propositions.data?.filter((p) => p.statut === 'envoyee').length ?? 0;

  const dateDuJour = new Date().toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <p className="text-sm text-encre-doux first-letter:uppercase">{dateDuJour}</p>
        <h1 className="text-3xl font-extrabold">
          {moi.data?.prenom ? `Bonjour ${moi.data.prenom}` : 'Tableau de bord'}
        </h1>
      </header>

      {prochain.data && <ProchainAudit rdv={prochain.data} maintenant={maintenant} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tuile
          libelle="Audits aujourd’hui"
          valeur={String(aujourdhui.data?.length ?? 0)}
          href="/formateur/rendez-vous"
        />
        <Tuile
          libelle="À faire"
          valeur={String(taches.length)}
          ton={taches.some((t) => t.ton === 'probleme') ? 'probleme' : 'neutre'}
        />
        <Tuile
          libelle="Propositions en cours"
          valeur={String(enCours)}
          detail={
            admin ? `${acceptees30} acceptée${acceptees30 > 1 ? 's' : ''} sur 30 jours` : undefined
          }
        />
        {admin && (
          <Tuile
            libelle="Présence aux audits"
            valeur={pourcentage(honores30, honores30 + absents30)}
            detail="Sur 30 jours"
            href="/formateur/statistiques"
          />
        )}
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Aujourd’hui</h2>
        {aujourdhui.data?.length ? (
          <ul className={LISTE}>
            {aujourdhui.data.map((rdv) => (
              <li key={rdv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
                <span className="w-14 font-semibold tabular-nums">{heure(rdv.debut)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{nomComplet(rdv.leads)}</span>
                  {/* Ce qu'il faut avoir en tête en décrochant, sans ouvrir la fiche. */}
                  {rdv.leads && (
                    <span className="block text-encre-doux">
                      {[
                        libelle('tranche_budget', rdv.leads.tranche_budget),
                        libelle('blocage', rdv.leads.blocage),
                        libelle('niveau_trading', rdv.leads.niveau_trading),
                      ].join(' · ')}
                    </span>
                  )}
                </span>
                {rdv.issue ? (
                  <Pastille ton={rdv.issue === 'honore' ? 'bon' : 'neutre'}>
                    {ISSUES_RDV[rdv.issue]}
                  </Pastille>
                ) : null}
                {rdv.leads?.telephone && (
                  <a
                    href={`tel:${rdv.leads.telephone.replace(/\s/g, '')}`}
                    className="text-encre-doux tabular-nums hover:underline"
                  >
                    {rdv.leads.telephone}
                  </a>
                )}
                {rdv.leads && (
                  <Link
                    href={`/formateur/clients/${rdv.leads.id}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    Préparer
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucun audit aujourd’hui.</p>
          </Carte>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">À faire</h2>
          <p className="text-sm text-encre-doux">
            Chaque ligne disparaît d’elle-même une fois le geste fait sur la fiche.
          </p>
        </div>
        {taches.length ? (
          <ul className={LISTE}>
            {taches.map((t) => (
              <li key={t.cle}>
                <Link
                  href={t.href}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm transition-colors hover:bg-surface"
                >
                  <span className="w-44 shrink-0">
                    <Pastille ton={t.ton}>{t.categorie}</Pastille>
                  </span>
                  <span className="font-medium">{t.qui}</span>
                  <span className="min-w-0 flex-1 text-encre-doux">{t.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">Rien en attente. Tout est à jour.</p>
          </Carte>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Les 7 prochains jours</h2>
        {semaine.data?.length ? (
          <ul className={LISTE}>
            {semaine.data.map((rdv) => (
              <li key={rdv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
                <span className="w-44 text-encre-doux">{dateHeure(rdv.debut)}</span>
                {rdv.leads ? (
                  <Link
                    href={`/formateur/clients/${rdv.leads.id}`}
                    className="flex-1 font-medium text-accent hover:underline"
                  >
                    {nomComplet(rdv.leads)}
                  </Link>
                ) : (
                  <span className="flex-1">Réservation sans fiche</span>
                )}
                {rdv.leads?.telephone && (
                  <a
                    href={`tel:${rdv.leads.telephone.replace(/\s/g, '')}`}
                    className="text-encre-doux tabular-nums hover:underline"
                  >
                    {rdv.leads.telephone}
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucun audit dans les 7 prochains jours.</p>
          </Carte>
        )}
      </section>

      {admin && (
        <p className="text-sm text-encre-doux">
          {emises30} proposition{emises30 > 1 ? 's' : ''} émise{emises30 > 1 ? 's' : ''} sur 30
          jours ·{' '}
          <Link href="/formateur/statistiques" className="text-accent hover:underline">
            toutes les statistiques
          </Link>
        </p>
      )}
    </div>
  );
}

type Prospect = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string;
  telephone: string | null;
  tranche_budget: Parameters<typeof libelle>[1];
  blocage: Parameters<typeof libelle>[1];
  niveau_trading: Parameters<typeof libelle>[1];
  delai_objectif: Parameters<typeof libelle>[1];
  prop_firm: Parameters<typeof libelle>[1];
  formations: { titre: string } | null;
};

/**
 * Le prochain audit, en tête d'écran : quand, avec qui, comment le joindre, et
 * ce qu'il a déclaré. Tout ce qu'il faut pour décrocher à l'heure — ou pour
 * prévenir d'un retard — sans ouvrir la fiche.
 */
function ProchainAudit({
  rdv,
  maintenant,
}: {
  rdv: { id: string; debut: string; leads: Prospect | null };
  maintenant: number;
}) {
  const l = rdv.leads;
  const minutes = Math.round((new Date(rdv.debut).getTime() - maintenant) / 60_000);
  const quand =
    minutes < 60
      ? `dans ${Math.max(minutes, 0)} min`
      : minutes < 24 * 60
        ? `dans ${Math.round(minutes / 60)} h`
        : new Date(rdv.debut).toLocaleDateString('fr-FR', {
            timeZone: 'Europe/Paris',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });

  return (
    <section className="space-y-4 rounded-carte border border-accent/30 bg-accent-doux p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-encre-doux uppercase">
            Prochain audit · {quand}
          </p>
          <h2 className="text-2xl font-extrabold">
            {l ? nomComplet(l) : 'Réservation sans fiche'}{' '}
            <span className="text-base font-medium text-encre-doux">à {heure(rdv.debut)}</span>
          </h2>
        </div>
        {l && (
          <Link
            href={`/formateur/clients/${l.id}`}
            className="text-sm font-semibold text-accent hover:underline"
          >
            Préparer sur la fiche →
          </Link>
        )}
      </div>
      {l && (
        <>
          <Coordonnees telephone={l.telephone} email={l.email} />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {(
              [
                ['Budget', 'tranche_budget', l.tranche_budget],
                ['Blocage', 'blocage', l.blocage],
                ['Niveau', 'niveau_trading', l.niveau_trading],
                ['Délai visé', 'delai_objectif', l.delai_objectif],
                ['Prop firm', 'prop_firm', l.prop_firm],
              ] as const
            ).map(([titre, champ, valeur]) => (
              <div key={champ}>
                <dt className="text-xs text-encre-doux">{titre}</dt>
                <dd className="font-medium">{libelle(champ, valeur)}</dd>
              </div>
            ))}
            <div>
              <dt className="text-xs text-encre-doux">Produit qui l’intéresse</dt>
              <dd className="font-medium">{l.formations?.titre ?? 'Pas précisé'}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
