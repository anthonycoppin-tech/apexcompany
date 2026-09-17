import Link from 'next/link';

import { formaterMontant } from '@apex/db';

import { EnTete, Tableau, Tuile, Vide } from '@/components/admin';
import { Histogramme } from '@/components/histogramme';
import { SOURCES } from '@/lib/crm/pipeline';
import { JOUR_MS, nomComplet, pourcentage } from '@/lib/formateur/suivi';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Statistiques' };

const PERIODES = [
  { valeur: '30', libelle: '30 jours', jours: 30 },
  { valeur: '90', libelle: '90 jours', jours: 90 },
  { valeur: '365', libelle: '12 mois', jours: 365 },
  { valeur: 'tout', libelle: 'Depuis le début', jours: null },
] as const;

const SEMAINES = 12;
const MOIS = 12;

const cellule = 'py-2.5 pr-4 tabular-nums';

/**
 * `/admin/statistiques` — l'activité entière, argent compris.
 *
 * Le pendant des statistiques du formateur, sans leur cloisonnement : ici on
 * lit tout ce que la RLS ouvre au staff — encaissements, remboursements,
 * abonnements, et chaque formateur côte à côte.
 *
 * **Deux mesures de l'argent, et elles ne se confondent pas.** L'**encaissé**
 * vient de `payments` (ce qui est réellement entré) ; le **signé** vient des
 * propositions acceptées (ce que le formateur a vendu, au prix qu'il a
 * proposé). Le premier fait foi pour la trésorerie, le second pour juger un
 * vendeur — les deux diffèrent dès qu'un abonnement se renouvelle ou qu'un
 * achat se fait sans proposition.
 *
 * Tout est compté en mémoire : à l'échelle du lancement, quelques centaines de
 * lignes. Le jour où ça pèse, c'est une fonction SQL comme `stats_conversion()`
 * qui prend le relais, pas une pagination.
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

  const [
    paiements,
    remboursements,
    litiges,
    abonnements,
    inscriptions,
    leads,
    rdv,
    propositions,
    formateurs,
    notes,
  ] = await Promise.all([
    supabase
      .from('payments')
      .select(
        'montant_cents, devise, statut, paid_at, orders(formation_id, formations(titre, type_produit), leads(source))',
      )
      .eq('statut', 'reussi'),
    supabase.from('refunds').select('montant_cents, statut, traite_at'),
    supabase.from('disputes').select('montant_cents, statut, created_at'),
    supabase
      .from('subscriptions')
      .select('statut, updated_at, resiliation_demandee_le, formations(titre, prix_cents)'),
    supabase
      .from('inscriptions')
      .select('statut, date_debut, date_fin_acces, formateur_id, formations(titre, type_produit)'),
    supabase.from('leads').select('id, statut, source, created_at, assigned_to'),
    supabase.from('appointments').select('issue, statut, debut, created_at, conseiller_id'),
    supabase
      .from('propositions')
      .select('statut, montant_cents, created_at, formateur_id, formations(prix_cents)'),
    supabase
      .from('user_roles')
      .select('user_id, profiles!user_roles_user_id_fkey(prenom, nom, email)')
      .eq('role', 'formateur'),
    supabase.from('suivi_notes').select('formateur_id, created_at'),
  ]);

  const devise = paiements.data?.[0]?.devise ?? 'EUR';
  const euros = (cents: number) => formaterMontant(cents, devise);

  // ── L'argent ─────────────────────────────────────────────────────────────
  const payesPeriode = (paiements.data ?? []).filter((p) => dansPeriode(p.paid_at));
  const encaisse = payesPeriode.reduce((t, p) => t + p.montant_cents, 0);
  const rembourses = (remboursements.data ?? []).filter(
    (r) => r.statut === 'traite' && dansPeriode(r.traite_at),
  );
  const montantRembourse = rembourses.reduce((t, r) => t + r.montant_cents, 0);
  const litigesOuverts = (litiges.data ?? []).filter((l) =>
    ['ouvert', 'preuves_envoyees'].includes(l.statut),
  );

  const parMois = Array.from({ length: MOIS }, (_, i) => {
    const d = new Date(maintenant);
    d.setDate(1);
    d.setMonth(d.getMonth() - (MOIS - 1 - i));
    const cle = d.toISOString().slice(0, 7);
    const libelle = d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'Europe/Paris' });
    const cents = (paiements.data ?? [])
      .filter((p) => p.paid_at?.slice(0, 7) === cle)
      .reduce((t, p) => t + p.montant_cents, 0);
    return {
      libelle,
      // Le graphique compte en euros entiers : une barre ne se lit pas au centime.
      valeur: Math.round(cents / 100),
      detail: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    };
  });

  type Ligne = { cle: string; libelle: string; ventes: number; montant: number };
  const regrouper = (cle: (p: (typeof payesPeriode)[number]) => [string, string]) => {
    const lignes = new Map<string, Ligne>();
    for (const p of payesPeriode) {
      const [k, libelle] = cle(p);
      const ligne = lignes.get(k) ?? { cle: k, libelle, ventes: 0, montant: 0 };
      ligne.ventes += 1;
      ligne.montant += p.montant_cents;
      lignes.set(k, ligne);
    }
    return [...lignes.values()].sort((a, b) => b.montant - a.montant);
  };
  const parProduit = regrouper((p) => [
    p.orders?.formation_id ?? 'inconnu',
    p.orders?.formations?.titre ?? 'Produit inconnu',
  ]);
  const TYPES: Record<string, string> = {
    abonnement: 'Abonnements',
    accompagnement: 'Accompagnements',
    formation: 'Formations',
  };
  const parType = regrouper((p) => {
    const t = p.orders?.formations?.type_produit ?? 'inconnu';
    return [t, TYPES[t] ?? 'Inconnu'];
  });

  // ── Les abonnements ──────────────────────────────────────────────────────
  const tousAbos = abonnements.data ?? [];
  const abosActifs = tousAbos.filter((a) => a.statut === 'active');
  // Le revenu mensuel récurrent au prix du catalogue : l'abonnement ne porte
  // pas son montant, et une remise sur un abonnement n'existe pas aujourd'hui.
  const mrr = abosActifs.reduce((t, a) => t + (a.formations?.prix_cents ?? 0), 0);
  const impayes = tousAbos.filter((a) => a.statut === 'impayee').length;
  const resiliationsDemandees = abosActifs.filter((a) => a.resiliation_demandee_le).length;
  const arretes = tousAbos.filter(
    (a) => ['resiliee', 'terminee'].includes(a.statut) && dansPeriode(a.updated_at),
  ).length;

  // ── Le tunnel ────────────────────────────────────────────────────────────
  const tousLeads = leads.data ?? [];
  const leadsPeriode = tousLeads.filter((l) => dansPeriode(l.created_at));
  const tousRdv = rdv.data ?? [];
  const rdvPeriode = tousRdv.filter((r) => dansPeriode(r.debut));
  const honores = rdvPeriode.filter((r) => r.issue === 'honore').length;
  const absents = rdvPeriode.filter((r) => r.issue === 'absent').length;
  const toutesProps = propositions.data ?? [];
  const propsPeriode = toutesProps.filter((p) => dansPeriode(p.created_at));
  const acceptees = propsPeriode.filter((p) => p.statut === 'acceptee');

  const tunnel = [
    { libelle: 'Formulaires reçus', valeur: leadsPeriode.length },
    { libelle: 'Audits réservés', valeur: tousRdv.filter((r) => dansPeriode(r.created_at)).length },
    { libelle: 'Audits honorés', valeur: honores },
    { libelle: 'Propositions émises', valeur: propsPeriode.length },
    { libelle: 'Propositions acceptées', valeur: acceptees.length },
    { libelle: 'Paiements encaissés', valeur: payesPeriode.length },
  ];
  const tunnelMax = Math.max(1, ...tunnel.map((t) => t.valeur));

  const formulairesParSemaine = Array.from({ length: SEMAINES }, (_, i) => {
    const fin = maintenant - (SEMAINES - 1 - i) * 7 * JOUR_MS;
    const debut = fin - 7 * JOUR_MS;
    const libelle = new Date(debut + JOUR_MS).toLocaleDateString('fr-FR', {
      timeZone: 'Europe/Paris',
      day: 'numeric',
      month: 'short',
    });
    return {
      libelle,
      detail: `Semaine du ${libelle}`,
      valeur: tousLeads.filter((l) => {
        const t = new Date(l.created_at).getTime();
        return t > debut && t <= fin;
      }).length,
    };
  });

  // Chaque réseau, du formulaire à l'argent encaissé. Un achat sans prospect
  // (l'abonnement en self-service) n'a pas de réseau : il a sa propre ligne
  // plutôt que de disparaître du total.
  const reseaux = new Map<
    string,
    { cle: string; libelle: string; formulaires: number; clients: number; encaisse: number }
  >();
  const reseau = (cle: string) => {
    const ligne = reseaux.get(cle) ?? {
      cle,
      libelle: cle === 'sans' ? 'Achat direct, sans formulaire' : (SOURCES[cle] ?? cle),
      formulaires: 0,
      clients: 0,
      encaisse: 0,
    };
    reseaux.set(cle, ligne);
    return ligne;
  };
  for (const l of leadsPeriode) {
    const ligne = reseau(l.source);
    ligne.formulaires += 1;
    if (l.statut === 'gagne') ligne.clients += 1;
  }
  for (const p of payesPeriode)
    reseau(p.orders?.leads?.source ?? 'sans').encaisse += p.montant_cents;
  const parReseau = [...reseaux.values()].sort(
    (a, b) => b.encaisse - a.encaisse || b.formulaires - a.formulaires,
  );

  // ── Les formateurs ───────────────────────────────────────────────────────
  const inscriptionsActives = (inscriptions.data ?? []).filter((i) => i.statut === 'active');
  const parFormateur = (formateurs.data ?? [])
    .map((f) => {
      const id = f.user_id;
      const sesProps = propsPeriode.filter((p) => p.formateur_id === id);
      const sesAcceptees = sesProps.filter((p) => p.statut === 'acceptee');
      const sesRdv = rdvPeriode.filter((r) => r.conseiller_id === id);
      return {
        id,
        nom: nomComplet(f.profiles, f.profiles?.email ?? 'Formateur'),
        prospects: leadsPeriode.filter((l) => l.assigned_to === id).length,
        honores: sesRdv.filter((r) => r.issue === 'honore').length,
        absents: sesRdv.filter((r) => r.issue === 'absent').length,
        emises: sesProps.length,
        acceptees: sesAcceptees.length,
        signe: sesAcceptees.reduce((t, p) => t + p.montant_cents, 0),
        remise: sesAcceptees.reduce((t, p) => t + (p.formations?.prix_cents ?? p.montant_cents), 0),
        suivis: inscriptionsActives.filter((i) => i.formateur_id === id).length,
        notes: (notes.data ?? []).filter((n) => n.formateur_id === id && dansPeriode(n.created_at))
          .length,
      };
    })
    .sort((a, b) => b.signe - a.signe || b.prospects - a.prospects);

  const sansFormateur = inscriptionsActives.filter(
    (i) => !i.formateur_id && i.formations?.type_produit !== 'abonnement',
  ).length;

  // ── Les accès ────────────────────────────────────────────────────────────
  const accesParProduit = new Map<string, { titre: string; actifs: number; finProche: number }>();
  for (const i of inscriptionsActives) {
    const titre = i.formations?.titre ?? 'Produit inconnu';
    const ligne = accesParProduit.get(titre) ?? { titre, actifs: 0, finProche: 0 };
    ligne.actifs += 1;
    if (
      i.date_fin_acces &&
      new Date(`${i.date_fin_acces}T23:59:59`).getTime() - maintenant <= 30 * JOUR_MS
    ) {
      ligne.finProche += 1;
    }
    accesParProduit.set(titre, ligne);
  }

  return (
    <div className="space-y-10">
      <EnTete
        titre="Statistiques"
        description="Toute l’activité, argent compris. Le tableau de bord dit ce qui se passe aujourd’hui ; cette page dit comment ça évolue."
      />

      <nav className="flex flex-wrap gap-2" aria-label="Période">
        {PERIODES.map((p) => (
          <Link
            key={p.valeur}
            href={`/admin/statistiques?periode=${p.valeur}`}
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

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Chiffre d’affaires</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tuile
            libelle="Encaissé"
            valeur={euros(encaisse)}
            detail={`${payesPeriode.length} paiement${payesPeriode.length > 1 ? 's' : ''}`}
            href="/admin/paiements/transactions"
          />
          <Tuile
            libelle="Remboursé"
            valeur={euros(montantRembourse)}
            detail={`${rembourses.length} remboursement${rembourses.length > 1 ? 's' : ''}`}
            href="/admin/paiements/remboursements"
          />
          <Tuile
            libelle="Net"
            valeur={euros(encaisse - montantRembourse)}
            detail={
              payesPeriode.length
                ? `Panier moyen ${euros(Math.round(encaisse / payesPeriode.length))}`
                : 'Aucun paiement sur la période'
            }
          />
          <Tuile
            libelle="Litiges ouverts"
            valeur={String(litigesOuverts.length)}
            detail={
              litigesOuverts.length
                ? `${euros(litigesOuverts.reduce((t, l) => t + l.montant_cents, 0))} contestés`
                : 'Aucun'
            }
            ton={litigesOuverts.length ? 'probleme' : 'neutre'}
            href="/admin/paiements/litiges"
          />
        </div>
        <div className="space-y-2 rounded-carte border border-filet bg-fond p-5">
          <h3 className="text-sm font-semibold text-encre-doux">
            Encaissé par mois, en euros — les {MOIS} derniers mois
          </h3>
          <Histogramme titre="Encaissé par mois en euros" points={parMois} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <TableauMontants titre="Par produit" lignes={parProduit} total={encaisse} euros={euros} />
          <TableauMontants titre="Par type" lignes={parType} total={encaisse} euros={euros} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Abonnements</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tuile
            libelle="Actifs"
            valeur={String(abosActifs.length)}
            detail={`${euros(mrr)} par mois au prix catalogue`}
            href="/admin/abonnements"
          />
          <Tuile
            libelle="Impayés"
            valeur={String(impayes)}
            ton={impayes ? 'probleme' : 'neutre'}
            href="/admin/abonnements"
          />
          <Tuile
            libelle="Résiliation demandée"
            valeur={String(resiliationsDemandees)}
            detail="Encore actifs jusqu’à la fin de la période payée"
          />
          <Tuile
            libelle="Arrêtés sur la période"
            valeur={String(arretes)}
            detail={`Attrition ${pourcentage(arretes, abosActifs.length + arretes)}`}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Du formulaire au paiement</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <ol className="space-y-2 rounded-carte border border-filet bg-fond p-5">
            {tunnel.map((etape) => (
              <li
                key={etape.libelle}
                className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm"
              >
                <span className="text-encre-doux">{etape.libelle}</span>
                <span className="h-5 rounded-r-[4px] bg-surface" aria-hidden="true">
                  <span
                    className="block h-full rounded-r-[4px] bg-accent"
                    style={{
                      width: `${Math.max((etape.valeur / tunnelMax) * 100, etape.valeur ? 1 : 0)}%`,
                    }}
                  />
                </span>
                <span className="text-right font-semibold tabular-nums">{etape.valeur}</span>
              </li>
            ))}
            <li className="pt-2 text-xs text-encre-doux">
              Présence aux audits : {pourcentage(honores, honores + absents)} · acceptation des
              propositions : {pourcentage(acceptees.length, propsPeriode.length)}
            </li>
          </ol>
          <div className="space-y-2 rounded-carte border border-filet bg-fond p-5">
            <h3 className="text-sm font-semibold text-encre-doux">
              Formulaires reçus, semaine par semaine
            </h3>
            <Histogramme titre="Formulaires reçus par semaine" points={formulairesParSemaine} />
          </div>
        </div>

        <h3 className="text-sm font-semibold text-encre-doux">Par réseau d’origine</h3>
        {parReseau.length ? (
          <div className="rounded-carte border border-filet bg-fond p-5">
            <Tableau
              colonnes={['Réseau', 'Formulaires', 'Clients', 'Conversion', 'Encaissé']}
              largeurMin="36rem"
            >
              {parReseau.map((r) => (
                <tr key={r.cle} className="border-b border-filet last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{r.libelle}</td>
                  <td className={cellule}>{r.cle === 'sans' ? '—' : r.formulaires}</td>
                  <td className={cellule}>{r.cle === 'sans' ? '—' : r.clients}</td>
                  <td className={cellule}>
                    {r.cle === 'sans' ? '—' : pourcentage(r.clients, r.formulaires)}
                  </td>
                  <td className={cellule}>{euros(r.encaisse)}</td>
                </tr>
              ))}
            </Tableau>
          </div>
        ) : (
          <Vide>Aucun formulaire ni paiement sur la période.</Vide>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Formateurs</h2>
          <p className="text-sm text-encre-doux">
            Le « signé » est la somme des propositions acceptées, au prix proposé. Les accès suivis
            et les notes disent si l’après-vente est tenu.
            {sansFormateur > 0 &&
              ` ${sansFormateur} accès en cours n’ont aucun formateur : à affecter depuis la fiche client.`}
          </p>
        </div>
        {parFormateur.length ? (
          <div className="rounded-carte border border-filet bg-fond p-5">
            <Tableau
              colonnes={[
                'Formateur',
                'Prospects',
                'Audits honorés',
                'Présence',
                'Propositions',
                'Acceptées',
                'Signé',
                'Remise',
                'Accès suivis',
                'Notes',
              ]}
              largeurMin="64rem"
            >
              {parFormateur.map((f) => (
                <tr key={f.id} className="border-b border-filet last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{f.nom}</td>
                  <td className={cellule}>{f.prospects}</td>
                  <td className={cellule}>{f.honores}</td>
                  <td className={cellule}>{pourcentage(f.honores, f.honores + f.absents)}</td>
                  <td className={cellule}>{f.emises}</td>
                  <td className={cellule}>
                    {f.acceptees}{' '}
                    <span className="text-encre-doux">({pourcentage(f.acceptees, f.emises)})</span>
                  </td>
                  <td className={cellule}>{euros(f.signe)}</td>
                  <td className={cellule}>
                    {f.remise ? `${Math.round((1 - f.signe / f.remise) * 100)} %` : '—'}
                  </td>
                  <td className={cellule}>{f.suivis}</td>
                  <td className={cellule}>{f.notes}</td>
                </tr>
              ))}
            </Tableau>
          </div>
        ) : (
          <Vide>Aucun compte n’a le rôle formateur.</Vide>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Accès en cours</h2>
        {accesParProduit.size ? (
          <div className="rounded-carte border border-filet bg-fond p-5">
            <Tableau
              colonnes={['Produit', 'Actifs', 'Se terminent sous 30 jours']}
              largeurMin="28rem"
            >
              {[...accesParProduit.values()]
                .sort((a, b) => b.actifs - a.actifs)
                .map((a) => (
                  <tr key={a.titre} className="border-b border-filet last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{a.titre}</td>
                    <td className={cellule}>{a.actifs}</td>
                    <td className={cellule}>{a.finProche}</td>
                  </tr>
                ))}
            </Tableau>
          </div>
        ) : (
          <Vide>Aucun accès ouvert.</Vide>
        )}
      </section>
    </div>
  );
}

function TableauMontants({
  titre,
  lignes,
  total,
  euros,
}: {
  titre: string;
  lignes: Array<{ cle: string; libelle: string; ventes: number; montant: number }>;
  total: number;
  euros: (cents: number) => string;
}) {
  return (
    <div className="space-y-2 rounded-carte border border-filet bg-fond p-5">
      <h3 className="text-sm font-semibold text-encre-doux">{titre}</h3>
      {lignes.length ? (
        <Tableau colonnes={['', 'Paiements', 'Encaissé', 'Part']} largeurMin="24rem">
          {lignes.map((l) => (
            <tr key={l.cle} className="border-b border-filet last:border-0">
              <td className="py-2.5 pr-4 font-medium">{l.libelle}</td>
              <td className={cellule}>{l.ventes}</td>
              <td className={cellule}>{euros(l.montant)}</td>
              <td className={cellule}>{pourcentage(l.montant, total)}</td>
            </tr>
          ))}
        </Tableau>
      ) : (
        <p className="text-sm text-encre-doux">Aucun paiement sur la période.</p>
      )}
    </div>
  );
}
