import Link from 'next/link';
import { redirect } from 'next/navigation';

import { formaterMontant } from '@apex/db';

import { Tableau, Tuile } from '@/components/admin';
import { Histogramme } from '@/components/histogramme';
import { SelecteurPeriode } from '@/components/selecteur-periode';
import { estFormateurAdmin } from '@/lib/auth/profils';
import { getUserRoles } from '@/lib/auth/roles';
import { SOURCES } from '@/lib/crm/pipeline';
import {
  JOUR_MS,
  MOTIFS_PERTE,
  SANS_SUIVI_JOURS,
  joursRestants,
  duree,
  mediane,
  pourcentage,
  type MotifPerte,
} from '@/lib/formateur/suivi';
import {
  BLOCAGES,
  DELAIS_OBJECTIF,
  NIVEAUX_TRADING,
  PROP_FIRM,
  SITUATIONS_PRO,
  TRANCHES_BUDGET,
  ZONES_GEO,
} from '@/lib/qualification/questionnaire';
import { lirePeriode } from '@/lib/statistiques/periode';
import { createClient } from '@/lib/supabase/server';

const SEMAINES = 8;

type Ligne = { cle: string; libelle: string; prospects: number; clients: number };

/**
 * `/formateur/statistiques` — les chiffres de l'accompagnement commercial.
 *
 * **Réservé au formateur admin depuis le 25 septembre 2026** : le formateur
 * employé n'a pas accès aux statistiques (`lib/auth/profils.ts`). Le formateur
 * admin porte un rôle du staff, la RLS lui rend donc toute l'équipe — et il
 * peut restreindre à un formateur (`?formateur=`), filtré ici sur les colonnes
 * d'affectation.
 *
 * **Une journée se choisit** (`?jour=AAAA-MM-JJ`), demandé le même jour pour
 * lire les chiffres d'un événement sur sa seule journée.
 *
 * **Aucun encaissement.** Les seuls montants de cet écran sont ceux des
 * propositions qu'il a émises — le prix qu'il a proposé, l'exception documentée
 * dans CLAUDE.md. Ce que le client a réellement payé, remboursements compris,
 * lui reste fermé : `orders` et `payments` ne lui sont pas lisibles.
 *
 * Deux lectures cohabitent, et l'écran le dit : l'**entonnoir** suit les
 * prospects arrivés sur la période jusqu'où ils sont allés, l'**activité**
 * compte ce qui s'est passé sur la période, quelle que soit la date d'arrivée.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; jour?: string; formateur?: string }>;
}) {
  if (!estFormateurAdmin(await getUserRoles())) redirect('/formateur');

  const parametres = await searchParams;
  const periode = lirePeriode(parametres, '30');
  const dansPeriode = periode.dans;
  const maintenant = new Date().getTime();

  const supabase = await createClient();

  // Les formateurs de l'équipe, pour le filtre. Lisible parce que le
  // formateur admin est du staff (`user_roles_staff_lit`).
  const { data: equipe } = await supabase
    .from('user_roles')
    .select('user_id, profiles!user_roles_user_id_fkey(prenom, nom, email)')
    .eq('role', 'formateur');
  const formateurs = (equipe ?? []).map((f) => ({
    id: f.user_id,
    nom:
      [f.profiles?.prenom, f.profiles?.nom].filter(Boolean).join(' ') ||
      f.profiles?.email ||
      'Formateur',
  }));
  const choisi = formateurs.find((f) => f.id === parametres.formateur) ?? null;

  // Un filtre d'affichage, pas une frontière : la frontière, c'est la RLS.
  const qLeads = supabase
    .from('leads')
    .select(
      'id, statut, source, tranche_budget, blocage, niveau_trading, delai_objectif, prop_firm, situation_pro, zone_geo, created_at, user_id',
    );
  const qRdv = supabase
    .from('appointments')
    .select('id, lead_id, debut, created_at, issue, statut');
  const qProps = supabase
    .from('propositions')
    .select(
      'id, statut, created_at, updated_at, lead_id, user_id, montant_cents, devise, expire_le, formation_id, formations(titre, prix_cents)',
    );
  const qInscriptions = supabase
    .from('inscriptions')
    .select('id, statut, date_debut, date_fin_acces, formations(titre, modalite)');
  const qNotes = supabase
    .from('suivi_notes')
    .select('inscription_id, type, visible_client, created_at');

  const [leads, rdv, propositions, echanges, inscriptions, notes] = await Promise.all([
    choisi ? qLeads.eq('assigned_to', choisi.id) : qLeads,
    choisi ? qRdv.eq('conseiller_id', choisi.id) : qRdv,
    choisi ? qProps.eq('formateur_id', choisi.id) : qProps,
    supabase
      .from('lead_events')
      .select('lead_id, created_at, payload')
      .eq('type', 'echange')
      .order('created_at'),
    choisi ? qInscriptions.eq('formateur_id', choisi.id) : qInscriptions,
    choisi ? qNotes.eq('formateur_id', choisi.id) : qNotes,
  ]);

  const tousLeads = leads.data ?? [];
  const tousRdv = rdv.data ?? [];
  const toutesProps = propositions.data ?? [];
  // Les échanges suivent les prospects retenus : un échange n'a pas de
  // formateur à lui, il a une fiche.
  const leadsRetenus = new Set(tousLeads.map((l) => l.id));
  const tousEchanges = (echanges.data ?? []).filter((e) => leadsRetenus.has(e.lead_id));

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

  // ── Ventes ───────────────────────────────────────────────────────────────
  // « Vendu » veut dire : proposition acceptée, au montant proposé. C'est ce
  // que le formateur a signé, pas ce qui a été encaissé.
  const acceptees = propsPeriode.filter((p) => p.statut === 'acceptee');
  const signe = acceptees.reduce((total, p) => total + p.montant_cents, 0);
  const devise = toutesProps[0]?.devise ?? 'EUR';
  const enAttente = toutesProps.filter(
    (p) => p.statut === 'envoyee' && (!p.expire_le || new Date(p.expire_le).getTime() > maintenant),
  );
  const montantEnAttente = enAttente.reduce((total, p) => total + p.montant_cents, 0);
  const remises = acceptees
    .filter((p) => (p.formations?.prix_cents ?? 0) > 0)
    .map((p) => 1 - p.montant_cents / p.formations!.prix_cents);
  const remiseMoyenne = remises.length ? remises.reduce((a, b) => a + b, 0) / remises.length : null;

  type VenteProduit = {
    cle: string;
    titre: string;
    emises: number;
    acceptees: number;
    signe: number;
    catalogue: number;
  };
  const parProduit = new Map<string, VenteProduit>();
  for (const p of propsPeriode) {
    const ligne = parProduit.get(p.formation_id) ?? {
      cle: p.formation_id,
      titre: p.formations?.titre ?? 'Produit retiré',
      emises: 0,
      acceptees: 0,
      signe: 0,
      catalogue: 0,
    };
    ligne.emises += 1;
    if (p.statut === 'acceptee') {
      ligne.acceptees += 1;
      ligne.signe += p.montant_cents;
      ligne.catalogue += p.formations?.prix_cents ?? p.montant_cents;
    }
    parProduit.set(p.formation_id, ligne);
  }
  const ventesParProduit = [...parProduit.values()].sort(
    (a, b) => b.signe - a.signe || b.emises - a.emises,
  );

  // ── Formulaires reçus, sur les mêmes semaines que les audits ─────────────
  const formulairesParSemaine = semaines.map((semaine, i) => {
    const fin = maintenant - (SEMAINES - 1 - i) * 7 * JOUR_MS;
    const debut = fin - 7 * JOUR_MS;
    return {
      libelle: semaine.libelle,
      detail: `Semaine du ${semaine.libelle}`,
      valeur: tousLeads.filter((l) => {
        const t = new Date(l.created_at).getTime();
        return t > debut && t <= fin;
      }).length,
    };
  });

  const parNiveau = repartition((l) => l.niveau_trading, libellesDe(NIVEAUX_TRADING));
  const parDelai = repartition((l) => l.delai_objectif, libellesDe(DELAIS_OBJECTIF));
  const parPropFirm = repartition((l) => l.prop_firm, libellesDe(PROP_FIRM));
  const parSituation = repartition((l) => l.situation_pro, libellesDe(SITUATIONS_PRO));
  const parZone = repartition((l) => l.zone_geo, libellesDe(ZONES_GEO));

  // ── Accompagnements ──────────────────────────────────────────────────────
  // L'état du portefeuille est celui du jour ; seules les notes et les
  // nouvelles inscriptions suivent la période choisie.
  const toutesInscriptions = inscriptions.data ?? [];
  const actives = toutesInscriptions.filter((i) => i.statut === 'active');
  const individuels = actives.filter((i) => i.formations?.modalite === 'individuel');
  const finSous30 = actives.filter((i) => {
    const restants = joursRestants(i.date_fin_acces, maintenant);
    return restants !== null && restants <= 30;
  }).length;
  const toutesNotes = notes.data ?? [];
  const derniereNote = new Map<string, string>();
  for (const n of toutesNotes) {
    const actuelle = derniereNote.get(n.inscription_id);
    if (!actuelle || n.created_at > actuelle) derniereNote.set(n.inscription_id, n.created_at);
  }
  const aReprendre = individuels.filter(
    (i) =>
      maintenant - new Date(derniereNote.get(i.id) ?? i.date_debut).getTime() >
      SANS_SUIVI_JOURS * JOUR_MS,
  ).length;
  const sansObjectif = individuels.filter(
    (i) => !toutesNotes.some((n) => n.inscription_id === i.id && n.type === 'objectif'),
  ).length;
  const notesPeriode = toutesNotes.filter((n) => dansPeriode(n.created_at));
  const partagees = notesPeriode.filter((n) => n.visible_client).length;
  const nouveaux = toutesInscriptions.filter((i) => dansPeriode(i.date_debut)).length;

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold">Statistiques</h1>
          <p className="text-encre-doux first-letter:uppercase">
            {periode.libelle} · {choisi ? choisi.nom : 'toute l’équipe'}
          </p>
        </div>
        <SelecteurPeriode
          chemin="/formateur/statistiques"
          periode={periode}
          conserver={{ formateur: choisi?.id }}
        />
        {formateurs.length > 1 && (
          <nav className="flex flex-wrap gap-2 text-sm" aria-label="Formateur">
            {[{ id: '', nom: 'Toute l’équipe' }, ...formateurs].map((f) => {
              const actif = (choisi?.id ?? '') === f.id;
              const params = new URLSearchParams(periode.parametres);
              if (f.id) params.set('formateur', f.id);
              return (
                <Link
                  key={f.id || 'tous'}
                  href={`/formateur/statistiques?${params.toString()}`}
                  aria-current={actif ? 'page' : undefined}
                  className={`rounded-full border px-3 py-1 ${
                    actif
                      ? 'border-accent text-encre'
                      : 'border-filet text-encre-doux hover:bg-fond'
                  }`}
                >
                  {f.nom}
                </Link>
              );
            })}
          </nav>
        )}
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
          <h2 className="text-xl font-bold">Ventes</h2>
          <p className="text-sm text-encre-doux">
            Les propositions acceptées sur la période, au montant proposé — pas ce qui a été
            encaissé, qui se lit dans le back-office.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tuile
            libelle="Ventes"
            valeur={String(acceptees.length)}
            detail={`${pourcentage(acceptees.length, propsPeriode.length)} des propositions émises`}
          />
          <Tuile
            libelle="Montant signé"
            valeur={formaterMontant(signe, devise)}
            detail={
              acceptees.length
                ? `${formaterMontant(Math.round(signe / acceptees.length), devise)} par vente en moyenne`
                : 'Aucune vente sur la période'
            }
          />
          <Tuile
            libelle="Remise moyenne"
            valeur={remiseMoyenne === null ? '—' : `${Math.round(remiseMoyenne * 100)} %`}
            detail="Écart au prix catalogue"
          />
          <Tuile
            libelle="En attente de réponse"
            valeur={String(enAttente.length)}
            detail={
              enAttente.length
                ? `${formaterMontant(montantEnAttente, devise)} proposés`
                : 'Aucune proposition ouverte'
            }
          />
        </div>
        {ventesParProduit.length > 0 && (
          <Tableau
            colonnes={['Produit', 'Émises', 'Acceptées', 'Taux', 'Montant signé', 'Remise']}
            largeurMin="36rem"
          >
            {ventesParProduit.map((v) => (
              <tr key={v.cle} className="border-b border-filet last:border-0">
                <td className="py-2.5 pr-4 font-medium">{v.titre}</td>
                <td className="py-2.5 pr-4 tabular-nums">{v.emises}</td>
                <td className="py-2.5 pr-4 tabular-nums">{v.acceptees}</td>
                <td className="py-2.5 pr-4 tabular-nums">{pourcentage(v.acceptees, v.emises)}</td>
                <td className="py-2.5 pr-4 tabular-nums">
                  {v.acceptees ? formaterMontant(v.signe, devise) : '—'}
                </td>
                <td className="py-2.5 pr-4 tabular-nums">
                  {v.catalogue ? `${Math.round((1 - v.signe / v.catalogue) * 100)} %` : '—'}
                </td>
              </tr>
            ))}
          </Tableau>
        )}
      </section>

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
        <Histogramme titre="Audits honorés par semaine" points={semaines} />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Formulaires reçus, semaine par semaine</h2>
          <p className="text-sm text-encre-doux">
            Les prospects qui vous ont été confiés, par semaine d’arrivée.
          </p>
        </div>
        <Histogramme titre="Formulaires reçus par semaine" points={formulairesParSemaine} />
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
        { titre: 'Conversion par niveau', lignes: parNiveau },
        { titre: 'Conversion par délai visé', lignes: parDelai },
        { titre: 'Conversion par situation prop firm', lignes: parPropFirm },
        { titre: 'Conversion par situation professionnelle', lignes: parSituation },
        { titre: 'Conversion par zone', lignes: parZone },
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

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Accompagnements</h2>
          <p className="text-sm text-encre-doux">
            Les clients qui vous sont confiés, à ce jour. Les notes et les nouveaux accompagnements
            suivent la période choisie.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tuile
            libelle="En cours"
            valeur={String(actives.length)}
            detail={`${individuels.length} individuel${individuels.length > 1 ? 's' : ''}, ${actives.length - individuels.length} en groupe`}
            href="/formateur/accompagnements"
          />
          <Tuile
            libelle="Suivi à reprendre"
            valeur={String(aReprendre)}
            detail={`Sans note depuis ${SANS_SUIVI_JOURS} jours`}
            ton={aReprendre > 0 ? 'probleme' : 'neutre'}
            href="/formateur/accompagnements?vue=a-reprendre"
          />
          <Tuile
            libelle="Fin d’accès sous 30 jours"
            valeur={String(finSous30)}
            detail="Le moment de parler de la suite"
            href="/formateur/accompagnements?vue=fin-proche"
          />
          <Tuile
            libelle="Notes écrites"
            valeur={String(notesPeriode.length)}
            detail={`${partagees} partagée${partagees > 1 ? 's' : ''} avec le client`}
          />
        </div>
        <p className="text-sm text-encre-doux">
          Nouveaux accompagnements sur la période : {nouveaux} ·{' '}
          {sansObjectif > 0
            ? `sans objectif fixé : ${sansObjectif}`
            : 'chaque accompagnement individuel a un objectif'}
        </p>
      </section>
    </div>
  );
}
