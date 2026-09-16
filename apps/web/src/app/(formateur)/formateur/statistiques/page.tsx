import Link from 'next/link';

import { Tableau, Tuile } from '@/components/admin';
import { SOURCES } from '@/lib/crm/pipeline';
import {
  JOUR_MS,
  MOTIFS_PERTE,
  duree,
  mediane,
  pourcentage,
  type MotifPerte,
} from '@/lib/formateur/suivi';
import { BLOCAGES, TRANCHES_BUDGET } from '@/lib/qualification/questionnaire';
import { createClient } from '@/lib/supabase/server';

const PERIODES = [
  { valeur: '30', libelle: '30 jours', jours: 30 },
  { valeur: '90', libelle: '90 jours', jours: 90 },
  { valeur: '365', libelle: '12 mois', jours: 365 },
  { valeur: 'tout', libelle: 'Depuis le début', jours: null },
] as const;

const SEMAINES = 8;

type Ligne = { cle: string; libelle: string; prospects: number; clients: number };

/**
 * `/formateur/statistiques` — ses chiffres, et seulement les siens.
 *
 * Le périmètre n'est pas filtré ici : les politiques RLS ne laissent lire que
 * ses prospects, ses audits et ses propositions, donc compter tout ce qui
 * revient donne exactement ses chiffres.
 *
 * **Aucun montant.** La conversion se mesure en personnes, pas en euros
 * encaissés — ce que le formateur n'a pas à connaître.
 *
 * Deux lectures cohabitent, et l'écran le dit : l'**entonnoir** suit les
 * prospects arrivés sur la période jusqu'où ils sont allés, l'**activité**
 * compte ce qui s'est passé sur la période, quelle que soit la date d'arrivée.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode } = await searchParams;
  const choisie = PERIODES.find((p) => p.valeur === periode) ?? PERIODES[1];
  const maintenant = new Date().getTime();
  const depuisMs = choisie.jours === null ? 0 : maintenant - choisie.jours * JOUR_MS;
  const dansPeriode = (d: string | null | undefined) =>
    !!d && new Date(d).getTime() >= depuisMs && new Date(d).getTime() <= maintenant;

  const supabase = await createClient();

  const [leads, rdv, propositions, echanges] = await Promise.all([
    supabase
      .from('leads')
      .select('id, statut, source, tranche_budget, blocage, created_at, user_id'),
    supabase.from('appointments').select('id, lead_id, debut, created_at, issue, statut'),
    supabase.from('propositions').select('id, statut, created_at, updated_at, lead_id, user_id'),
    supabase
      .from('lead_events')
      .select('lead_id, created_at, payload')
      .eq('type', 'echange')
      .order('created_at'),
  ]);

  const tousLeads = leads.data ?? [];
  const tousRdv = rdv.data ?? [];
  const toutesProps = propositions.data ?? [];
  const tousEchanges = echanges.data ?? [];

  // ── L'entonnoir des prospects arrivés sur la période ─────────────────────
  const cohorte = tousLeads.filter((l) => dansPeriode(l.created_at));
  const premierEchange = new Map<string, string>();
  for (const e of tousEchanges)
    if (!premierEchange.has(e.lead_id)) premierEchange.set(e.lead_id, e.created_at);

  const rdvParLead = new Map<string, typeof tousRdv>();
  for (const r of tousRdv) {
    if (!r.lead_id) continue;
    rdvParLead.set(r.lead_id, [...(rdvParLead.get(r.lead_id) ?? []), r]);
  }
  const propsDe = (l: { id: string; user_id: string | null }) =>
    toutesProps.filter((p) => p.lead_id === l.id || (l.user_id && p.user_id === l.user_id));

  const contactes = cohorte.filter((l) => l.statut !== 'nouveau' || premierEchange.has(l.id));
  const avecAudit = cohorte.filter((l) => rdvParLead.has(l.id));
  const auditHonore = cohorte.filter((l) =>
    (rdvParLead.get(l.id) ?? []).some((r) => r.issue === 'honore'),
  );
  const avecProposition = cohorte.filter((l) => propsDe(l).length > 0);
  const clients = cohorte.filter((l) => l.statut === 'gagne');

  const entonnoir = [
    { libelle: 'Prospects arrivés', valeur: cohorte.length },
    { libelle: 'Contactés', valeur: contactes.length },
    { libelle: 'Audit réservé', valeur: avecAudit.length },
    { libelle: 'Audit honoré', valeur: auditHonore.length },
    { libelle: 'Proposition reçue', valeur: avecProposition.length },
    { libelle: 'Devenus clients', valeur: clients.length },
  ];

  // ── Réactivité ───────────────────────────────────────────────────────────
  const ecarts = (paires: Array<[string | null | undefined, string | null | undefined]>) =>
    paires
      .filter((p): p is [string, string] => !!p[0] && !!p[1])
      .map(([a, b]) => new Date(b).getTime() - new Date(a).getTime())
      .filter((ms) => ms >= 0);

  const delaiContact = mediane(
    ecarts(cohorte.map((l) => [l.created_at, premierEchange.get(l.id)])),
  );
  const delaiReservation = mediane(
    ecarts(
      cohorte.map((l) => [
        l.created_at,
        (rdvParLead.get(l.id) ?? []).map((r) => r.created_at).sort()[0],
      ]),
    ),
  );
  const delaiProposition = mediane(
    ecarts(
      auditHonore.map((l) => {
        const audit = (rdvParLead.get(l.id) ?? [])
          .filter((r) => r.issue === 'honore')
          .map((r) => r.debut)
          .sort()[0];
        const prop = propsDe(l)
          .map((p) => p.created_at)
          .filter((c) => !audit || c >= audit)
          .sort()[0];
        return [audit, prop];
      }),
    ),
  );
  const delaiDecision = mediane(
    ecarts(
      toutesProps
        .filter((p) => p.statut === 'acceptee' && dansPeriode(p.created_at))
        .map((p) => [p.created_at, p.updated_at]),
    ),
  );

  // ── L'activité sur la période ────────────────────────────────────────────
  const rdvPeriode = tousRdv.filter((r) => dansPeriode(r.debut));
  const honores = rdvPeriode.filter((r) => r.issue === 'honore').length;
  const absents = rdvPeriode.filter((r) => r.issue === 'absent').length;
  const annules = rdvPeriode.filter((r) => r.issue === 'annule' || r.statut === 'annule').length;
  const aConsigner = rdvPeriode.filter((r) => !r.issue && r.statut !== 'annule').length;

  const propsPeriode = toutesProps.filter((p) => dansPeriode(p.created_at));
  const parStatutProp = (s: string) => propsPeriode.filter((p) => p.statut === s).length;

  // ── Qui convertit ────────────────────────────────────────────────────────
  const repartition = (
    cle: (l: (typeof cohorte)[number]) => string | null,
    libelles: Record<string, string>,
  ): Ligne[] => {
    const lignes = new Map<string, Ligne>();
    for (const l of cohorte) {
      const k = cle(l) ?? 'inconnu';
      const ligne = lignes.get(k) ?? {
        cle: k,
        libelle: libelles[k] ?? 'Non renseigné',
        prospects: 0,
        clients: 0,
      };
      ligne.prospects += 1;
      if (l.statut === 'gagne') ligne.clients += 1;
      lignes.set(k, ligne);
    }
    return [...lignes.values()].sort((a, b) => b.prospects - a.prospects);
  };

  const libellesDe = (options: ReadonlyArray<{ valeur: string; libelle: string }>) =>
    Object.fromEntries(options.map((o) => [o.valeur, o.libelle.split(' — ')[0]]));

  const parBudget = repartition((l) => l.tranche_budget, libellesDe(TRANCHES_BUDGET));
  const parBlocage = repartition((l) => l.blocage, libellesDe(BLOCAGES));
  const parSource = repartition((l) => l.source, SOURCES);

  // ── Pourquoi on perd ─────────────────────────────────────────────────────
  const motifParLead = new Map<string, MotifPerte>();
  for (const e of tousEchanges) {
    const p = (e.payload ?? {}) as { statut_apres?: string; motif?: MotifPerte };
    if (p.statut_apres === 'perdu' && p.motif) motifParLead.set(e.lead_id, p.motif);
  }
  const perdus = cohorte.filter((l) => l.statut === 'perdu');
  const motifs = Object.entries(MOTIFS_PERTE)
    .map(([cle, libelle]) => ({
      libelle,
      valeur: perdus.filter((l) => motifParLead.get(l.id) === cle).length,
    }))
    .filter((m) => m.valeur > 0)
    .sort((a, b) => b.valeur - a.valeur);
  const sansMotif = perdus.filter((l) => !motifParLead.has(l.id)).length;

  // ── Les 8 dernières semaines ─────────────────────────────────────────────
  const semaines = Array.from({ length: SEMAINES }, (_, i) => {
    const fin = maintenant - (SEMAINES - 1 - i) * 7 * JOUR_MS;
    const debut = fin - 7 * JOUR_MS;
    const valeur = tousRdv.filter((r) => {
      const t = new Date(r.debut).getTime();
      return r.issue === 'honore' && t > debut && t <= fin;
    }).length;
    return {
      libelle: new Date(debut + JOUR_MS).toLocaleDateString('fr-FR', {
        timeZone: 'Europe/Paris',
        day: 'numeric',
        month: 'short',
      }),
      valeur,
    };
  });
  const maxSemaine = Math.max(1, ...semaines.map((s) => s.valeur));

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <h1 className="text-3xl font-extrabold">Mes statistiques</h1>
        <nav className="flex flex-wrap gap-2" aria-label="Période">
          {PERIODES.map((p) => (
            <Link
              key={p.valeur}
              href={`/formateur/statistiques?periode=${p.valeur}`}
              aria-current={p.valeur === choisie.valeur ? 'page' : undefined}
              className={`rounded-douce border px-3 py-1.5 text-sm ${
                p.valeur === choisie.valeur
                  ? 'border-encre bg-encre text-white'
                  : 'border-filet text-encre-doux hover:bg-fond'
              }`}
            >
              {p.libelle}
            </Link>
          ))}
        </nav>
      </div>

      {/* L'avertissement précède les chiffres, sinon il ne sert à rien : on ne
          revient pas sur un nombre qu'on a déjà lu comme vrai. */}
      {aConsigner > 0 && (
        <p className="rounded-douce border border-dashed border-filet-fort bg-surface p-4 text-sm leading-relaxed text-encre-doux">
          {aConsigner} audit{aConsigner > 1 ? 's' : ''} passé{aConsigner > 1 ? 's' : ''} sans issue
          consignée sur la période. Tant qu’ils ne le sont pas, ces chiffres sous-estiment autant
          les audits honorés que les absences.{' '}
          <Link href="/formateur/rendez-vous" className="font-semibold text-accent hover:underline">
            Les consigner
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tuile libelle="Prospects arrivés" valeur={String(cohorte.length)} />
        <Tuile
          libelle="Devenus clients"
          valeur={String(clients.length)}
          detail={`${pourcentage(clients.length, cohorte.length)} des prospects arrivés`}
        />
        <Tuile
          libelle="Présence aux audits"
          valeur={pourcentage(honores, honores + absents)}
          detail={`${honores} honoré${honores > 1 ? 's' : ''}, ${absents} absent${absents > 1 ? 's' : ''}`}
        />
        <Tuile
          libelle="Propositions acceptées"
          valeur={pourcentage(parStatutProp('acceptee'), propsPeriode.length)}
          detail={`${parStatutProp('acceptee')} sur ${propsPeriode.length} émise${propsPeriode.length > 1 ? 's' : ''}`}
        />
      </div>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Entonnoir</h2>
          <p className="text-sm text-encre-doux">
            Les prospects arrivés sur la période, et jusqu’où ils sont allés.
          </p>
        </div>
        <ol className="space-y-2">
          {entonnoir.map((etape) => {
            const part = cohorte.length ? etape.valeur / cohorte.length : 0;
            return (
              <li
                key={etape.libelle}
                className="grid grid-cols-[9rem_1fr_5.5rem] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_6rem]"
              >
                <span className="text-encre-doux">{etape.libelle}</span>
                <span className="h-6 rounded-r-[4px] bg-surface" aria-hidden="true">
                  <span
                    className="block h-full rounded-r-[4px] bg-accent"
                    style={{ width: `${Math.max(part * 100, etape.valeur ? 1 : 0)}%` }}
                    title={`${etape.libelle} : ${etape.valeur}`}
                  />
                </span>
                <span className="text-right tabular-nums">
                  <span className="font-semibold">{etape.valeur}</span>{' '}
                  <span className="text-encre-doux">
                    {pourcentage(etape.valeur, cohorte.length)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Réactivité</h2>
          <p className="text-sm text-encre-doux">
            Délais médians. Le premier est celui qui dépend le plus de vous, et celui qui pèse le
            plus sur la suite.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tuile libelle="Arrivée → premier contact" valeur={duree(delaiContact)} />
          <Tuile libelle="Arrivée → audit réservé" valeur={duree(delaiReservation)} />
          <Tuile libelle="Audit → proposition" valeur={duree(delaiProposition)} />
          <Tuile libelle="Proposition → acceptation" valeur={duree(delaiDecision)} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Audits honorés, semaine par semaine</h2>
          <p className="text-sm text-encre-doux">Les {SEMAINES} dernières semaines.</p>
        </div>
        <div
          className="flex h-40 items-end gap-2 border-b border-filet"
          role="img"
          aria-label={`Audits honorés par semaine : ${semaines.map((s) => `${s.libelle} ${s.valeur}`).join(', ')}`}
        >
          {semaines.map((s) => (
            <div
              key={s.libelle}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`Semaine du ${s.libelle} : ${s.valeur}`}
            >
              <span className="text-xs tabular-nums text-encre-doux">{s.valeur || ''}</span>
              <span
                className="w-full max-w-10 rounded-t-[4px] bg-accent"
                style={{ height: `${(s.valeur / maxSemaine) * 80}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2" aria-hidden="true">
          {semaines.map((s) => (
            <span key={s.libelle} className="flex-1 text-center text-xs text-encre-faible">
              {s.libelle}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Audits sur la période</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Honorés', honores],
              ['Absents', absents],
              ['Annulés', annules],
              ['Sans issue', aConsigner],
            ].map(([t, v]) => (
              <div key={t} className="rounded-carte border border-filet bg-fond p-4">
                <dt className="text-encre-doux">{t}</dt>
                <dd className="font-titre text-2xl font-extrabold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-3">
          <h2 className="text-xl font-bold">Propositions sur la période</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['En attente', parStatutProp('envoyee')],
              ['Acceptées', parStatutProp('acceptee')],
              ['Refusées', parStatutProp('refusee')],
              ['Expirées', parStatutProp('expiree')],
            ].map(([t, v]) => (
              <div key={t} className="rounded-carte border border-filet bg-fond p-4">
                <dt className="text-encre-doux">{t}</dt>
                <dd className="font-titre text-2xl font-extrabold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {[
        { titre: 'Conversion par budget déclaré', lignes: parBudget },
        { titre: 'Conversion par blocage', lignes: parBlocage },
        { titre: 'Conversion par réseau d’origine', lignes: parSource },
      ].map((bloc) => (
        <section key={bloc.titre} className="space-y-3">
          <h2 className="text-xl font-bold">{bloc.titre}</h2>
          {bloc.lignes.length ? (
            <Tableau colonnes={['', 'Prospects', 'Clients', 'Conversion']} largeurMin="28rem">
              {bloc.lignes.map((l) => (
                <tr key={l.cle} className="border-b border-filet last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{l.libelle}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{l.prospects}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{l.clients}</td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    {pourcentage(l.clients, l.prospects)}
                  </td>
                </tr>
              ))}
            </Tableau>
          ) : (
            <p className="text-sm text-encre-doux">Aucun prospect sur la période.</p>
          )}
        </section>
      ))}

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Pourquoi on perd</h2>
          <p className="text-sm text-encre-doux">
            Les motifs saisis en marquant un prospect perdu, sur les prospects arrivés pendant la
            période.
          </p>
        </div>
        {perdus.length === 0 ? (
          <p className="text-sm text-encre-doux">Aucun prospect perdu sur la période.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {motifs.map((m) => (
              <li key={m.libelle} className="flex justify-between gap-4 border-b border-filet pb-2">
                <span>{m.libelle}</span>
                <span className="tabular-nums">{m.valeur}</span>
              </li>
            ))}
            {sansMotif > 0 && (
              <li className="flex justify-between gap-4 text-encre-doux">
                <span>Sans motif consigné</span>
                <span className="tabular-nums">{sansMotif}</span>
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
