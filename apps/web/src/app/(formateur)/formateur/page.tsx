import Link from 'next/link';

import { Pastille, Tuile, type Ton } from '@/components/admin';
import { Carte, LISTE } from '@/components/ui';
import { bornesDuJour, dateCourte, dateHeure, heure } from '@/lib/format';
import { JOUR_MS, depuis, nomComplet, pourcentage, scoreAppel } from '@/lib/formateur/suivi';
import { libelle } from '@/lib/qualification/questionnaire';
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
 */
export default async function Page() {
  const supabase = await createClient();
  const { debut, fin } = bornesDuJour();
  const maintenant = new Date().getTime();
  const iso = (ms: number) => new Date(ms).toISOString();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [moi, aujourdhui, semaine, leads, rdvPasses, propositions, evenements, finsAcces] =
    await Promise.all([
      user
        ? supabase.from('profiles').select('prenom').eq('id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('appointments')
        .select(
          'id, debut, statut, issue, leads(id, prenom, nom, tranche_budget, blocage, niveau_trading)',
        )
        .gte('debut', debut)
        .lt('debut', fin)
        .neq('statut', 'annule')
        .order('debut'),
      supabase
        .from('appointments')
        .select('id, debut, leads(id, prenom, nom)')
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
        .select('id, date_fin_acces, user_id, formations(titre)')
        .eq('statut', 'active')
        .not('date_fin_acces', 'is', null)
        .lte('date_fin_acces', iso(maintenant + FIN_ACCES_JOURS * JOUR_MS).slice(0, 10))
        .order('date_fin_acces'),
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

  // 6. Les accès qui se terminent — le moment de parler de la suite.
  const { data: clientsFin } = finsAcces.data?.length
    ? await supabase
        .from('leads')
        .select('id, prenom, nom, user_id')
        .in(
          'user_id',
          finsAcces.data.map((i) => i.user_id),
        )
    : {
        data: [] as Array<{
          id: string;
          prenom: string | null;
          nom: string | null;
          user_id: string | null;
        }>,
      };
  for (const i of finsAcces.data ?? []) {
    const l = clientsFin?.find((c) => c.user_id === i.user_id);
    if (!l) continue;
    taches.push({
      cle: `fin-${i.id}`,
      ton: 'neutre',
      categorie: 'Accès qui se termine',
      qui: nomComplet(l),
      href: `/formateur/clients/${l.id}`,
      detail: `${i.formations?.titre ?? 'Accès'} · jusqu’au ${dateCourte(i.date_fin_acces)}`,
      ordre: 5,
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
          detail={`${acceptees30} acceptée${acceptees30 > 1 ? 's' : ''} sur 30 jours`}
        />
        <Tuile
          libelle="Présence aux audits"
          valeur={pourcentage(honores30, honores30 + absents30)}
          detail="Sur 30 jours"
          href="/formateur/statistiques"
        />
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
                  <Pastille ton={rdv.issue === 'honore' ? 'bon' : 'neutre'}>{rdv.issue}</Pastille>
                ) : null}
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
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucun audit dans les 7 prochains jours.</p>
          </Carte>
        )}
      </section>

      <p className="text-sm text-encre-doux">
        {emises30} proposition{emises30 > 1 ? 's' : ''} émise{emises30 > 1 ? 's' : ''} sur 30 jours
        ·{' '}
        <Link href="/formateur/statistiques" className="text-accent hover:underline">
          toutes les statistiques
        </Link>
      </p>
    </div>
  );
}
