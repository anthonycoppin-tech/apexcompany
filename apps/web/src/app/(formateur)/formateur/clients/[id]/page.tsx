import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formaterMontant } from '@apex/db';

import { Pastille, type Ton } from '@/components/admin';
import { Carte, LISTE } from '@/components/ui';
import { SOURCES } from '@/lib/crm/pipeline';
import { dateCourte, dateHeure } from '@/lib/format';
import {
  STATUTS,
  dansLeBudget,
  depuis,
  libelleEvenement,
  nomComplet,
  numeroWhatsApp,
} from '@/lib/formateur/suivi';
import { libelle } from '@/lib/qualification/questionnaire';
import { createClient } from '@/lib/supabase/server';

import { FormulaireProposition } from './formulaire-proposition';
import { FormulaireSuivi } from './formulaire-suivi';

const TON_STATUT: Record<string, Ton> = {
  nouveau: 'attente',
  contacte: 'neutre',
  rdv: 'neutre',
  proposition: 'attente',
  gagne: 'bon',
  perdu: 'neutre',
};

/**
 * `/formateur/clients/[id]` — la fiche qui prépare l'appel, et où on le consigne.
 *
 * En tête, ce qu'il faut pour décrocher : les moyens de joindre la personne et
 * la prochaine chose à faire. Puis ce que le formulaire a capté — budget,
 * blocage, niveau, délai —, ce qui oriente la recommandation. Puis l'historique,
 * pour ne pas redemander ce qu'un collègue a déjà demandé.
 *
 * **Jamais un montant payé.** Ni prix payé, ni facture, ni impayé. Le formateur
 * voit si l'accès est actif, pas ce qu'il a coûté — et ce n'est pas cet écran
 * qui le garantit, ce sont les politiques RLS : `orders`, `payments`,
 * `invoices` et `subscriptions` ne lui sont pas ouvertes. Les prix affichés
 * sont ceux du catalogue, publics, et ceux des propositions qu'il a émises.
 *
 * L'identifiant est celui du **prospect**, pas du compte : une personne qui n'a
 * jamais acheté a une fiche, et c'est même le cas le plus fréquent.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from('leads')
    // Un seul littéral, sans concaténation : supabase-js déduit le type des
    // lignes de la chaîne elle-même, et un `+` la réduit à `string`.
    .select(
      'id, prenom, nom, email, telephone, statut, source, created_at, user_id, zone_geo, tranche_age, situation_pro, niveau_trading, prop_firm, blocage, tranche_budget, delai_objectif, eligible, produit_souhaite_id',
    )
    .eq('id', id)
    .maybeSingle();

  // Introuvable ou hors périmètre : la RLS ne distingue pas les deux, et c'est
  // le bon comportement — répondre « existe mais pas pour vous » confirmerait
  // l'existence d'un client à qui n'a pas à le savoir.
  if (!lead) notFound();

  const [rdv, inscriptions, catalogue, propositions, evenements] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, debut, statut, issue, compte_rendu')
      .eq('lead_id', lead.id)
      .order('debut', { ascending: false }),
    lead.user_id
      ? supabase
          .from('inscriptions')
          .select('id, statut, date_debut, date_fin_acces, formations(titre, modalite)')
          .eq('user_id', lead.user_id)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from('formations')
      .select('id, titre, prix_cents, devise, type_produit, modalite')
      .eq('actif', true)
      .order('ordre'),
    lead.user_id
      ? supabase
          .from('propositions')
          .select('id, statut, montant_cents, devise, expire_le, created_at, formations(titre)')
          .eq('user_id', lead.user_id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from('lead_events')
      .select('id, type, payload, created_at, profiles(prenom, nom)')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  // Les notes se lisent APRÈS les inscriptions, et restreintes aux siennes : la
  // RLS laisse lire les notes de TOUS ses clients, et sans ce filtre chaque
  // fiche afficherait celles de tout le monde.
  const inscriptionIds = (inscriptions.data ?? []).map((i) => i.id);

  const notes = inscriptionIds.length
    ? await supabase
        .from('suivi_notes')
        .select('id, type, contenu, visible_client, created_at')
        .in('inscription_id', inscriptionIds)
        .order('created_at', { ascending: false })
    : { data: [] as never[] };

  const maintenant = new Date().getTime();
  const prochainRdv = (rdv.data ?? [])
    .filter((r) => new Date(r.debut).getTime() > maintenant && r.statut !== 'annule')
    .at(-1);
  const rdvSansIssue = (rdv.data ?? []).find(
    (r) => new Date(r.debut).getTime() < maintenant && !r.issue,
  );
  const auditHonore = (rdv.data ?? []).some((r) => r.issue === 'honore');
  const propositionOuverte = (propositions.data ?? []).find((p) => p.statut === 'envoyee');
  const dernierEchange = (evenements.data ?? []).find((e) => e.type === 'echange');

  // Une seule recommandation, la plus urgente. Une liste de cinq conseils sur
  // une fiche, c'est une liste qu'on ne lit plus.
  const prochaineEtape = ((): string | null => {
    if (lead.statut === 'gagne') return null;
    if (lead.statut === 'perdu') return null;
    if (rdvSansIssue) return 'Consigner l’issue de l’audit passé.';
    if (prochainRdv) return `Préparer l’audit du ${dateHeure(prochainRdv.debut)}.`;
    if (propositionOuverte) {
      return propositionOuverte.expire_le
        ? `Relancer : la proposition expire le ${dateCourte(propositionOuverte.expire_le)}.`
        : 'Relancer sur la proposition envoyée.';
    }
    if (auditHonore && lead.user_id) return 'Émettre la proposition discutée pendant l’audit.';
    if (lead.statut === 'nouveau') return 'Appeler : cette personne n’a encore eu aucun contact.';
    if (lead.statut === 'contacte') return 'Obtenir la réservation de l’audit.';
    return null;
  })();

  const reponses: Array<[string, string, string | null]> = [
    ['Budget déclaré', 'tranche_budget', lead.tranche_budget],
    ['Blocage principal', 'blocage', lead.blocage],
    ['Niveau', 'niveau_trading', lead.niveau_trading],
    ['Délai visé', 'delai_objectif', lead.delai_objectif],
    ['Prop firm', 'prop_firm', lead.prop_firm],
    ['Situation', 'situation_pro', lead.situation_pro],
    ['Zone', 'zone_geo', lead.zone_geo],
    ['Âge', 'tranche_age', lead.tranche_age],
  ];

  const produitSouhaite = catalogue.data?.find((f) => f.id === lead.produit_souhaite_id);
  const whatsapp = numeroWhatsApp(lead.telephone);
  const lienContact =
    'rounded-douce border border-filet px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface';

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold">{nomComplet(lead, 'Sans nom')}</h1>
            <Pastille ton={TON_STATUT[lead.statut]}>{STATUTS[lead.statut]}</Pastille>
          </div>
          <p className="text-sm text-encre-doux">
            Arrivé via {SOURCES[lead.source] ?? lead.source} le {dateCourte(lead.created_at)} ·
            dernier échange {depuis(dernierEchange?.created_at)}
          </p>
        </div>

        {/* Les moyens de joindre la personne en premier : c'est le geste pour
            lequel on ouvre la fiche. */}
        <div className="flex flex-wrap gap-2">
          {lead.telephone && (
            <a href={`tel:${lead.telephone.replace(/\s/g, '')}`} className={lienContact}>
              Appeler · {lead.telephone}
            </a>
          )}
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className={lienContact}
            >
              WhatsApp
            </a>
          )}
          <a href={`mailto:${lead.email}`} className={lienContact}>
            {lead.email}
          </a>
        </div>

        {prochaineEtape && (
          <p className="rounded-douce border border-accent/30 bg-accent-doux px-4 py-3 text-sm">
            <span className="font-semibold">Prochaine étape · </span>
            {prochaineEtape}
          </p>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Ce qu’il a répondu</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-carte border border-filet bg-fond p-5 text-sm sm:grid-cols-4">
          {reponses.map(([titre, champ, valeur]) => (
            <div key={champ} className="space-y-0.5">
              <dt className="text-xs font-semibold tracking-wide text-encre-faible uppercase">
                {titre}
              </dt>
              <dd>{libelle(champ, valeur)}</dd>
            </div>
          ))}
          <div className="col-span-2 space-y-0.5 sm:col-span-4">
            <dt className="text-xs font-semibold tracking-wide text-encre-faible uppercase">
              Produit qui l’intéresse
            </dt>
            <dd>{produitSouhaite?.titre ?? 'Pas précisé'}</dd>
          </div>
        </dl>
      </section>

      {!['gagne', 'perdu'].includes(lead.statut) && (catalogue.data?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Ce qui tient dans son budget</h2>
            <p className="text-sm text-encre-doux">
              Prix catalogue comparés au budget déclaré. Un repère pour l’audit, pas une règle : la
              remise reste possible.
            </p>
          </div>
          <ul className={`${LISTE} text-sm`}>
            {catalogue.data!.map((f) => {
              const tient = dansLeBudget(f.prix_cents, lead.tranche_budget);
              return (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span className="font-medium">
                    {f.titre}
                    {f.id === lead.produit_souhaite_id && (
                      <span className="ml-2 text-encre-doux">· souhaité</span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-encre-doux tabular-nums">
                      {formaterMontant(f.prix_cents, f.devise)}
                    </span>
                    {tient === null ? null : tient ? (
                      <Pastille ton="bon">Dans le budget</Pastille>
                    ) : (
                      <Pastille>Au-dessus</Pastille>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Consigner un échange</h2>
        <FormulaireSuivi leadId={lead.id} estClient={lead.statut === 'gagne'} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Historique</h2>
        {evenements.data?.length ? (
          <ol className="space-y-3 border-l border-filet pl-5 text-sm">
            {evenements.data.map((e) => {
              const payload = (e.payload ?? {}) as { contenu?: string | null };
              return (
                <li key={e.id} className="space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{libelleEvenement(e.type, e.payload)}</span>
                    <span className="text-xs text-encre-doux">
                      {dateHeure(e.created_at)}
                      {e.profiles ? ` · ${nomComplet(e.profiles, '')}` : ''}
                    </span>
                  </div>
                  {payload.contenu && (
                    <p className="whitespace-pre-wrap text-encre-doux">{payload.contenu}</p>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucun événement enregistré.</p>
          </Carte>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Rendez-vous</h2>
        {rdv.data?.length ? (
          <ul className="space-y-2 text-sm">
            {rdv.data.map((r) => (
              <li key={r.id} className="rounded-carte border border-filet bg-fond p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>{dateHeure(r.debut)}</span>
                  <span className="text-encre-doux">{r.issue ?? r.statut}</span>
                </div>
                {r.compte_rendu && (
                  <p className="mt-2 whitespace-pre-wrap text-encre-doux">{r.compte_rendu}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucun rendez-vous.</p>
          </Carte>
        )}
        {rdvSansIssue && (
          <Link
            href="/formateur/rendez-vous"
            className="inline-block text-sm font-semibold text-accent hover:underline"
          >
            Consigner l’issue →
          </Link>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Propositions</h2>

        {propositions.data?.length ? (
          <ul className={`${LISTE} text-sm`}>
            {propositions.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                <span className="flex-1">{p.formations?.titre ?? 'Formation'}</span>
                <span className="tabular-nums text-encre-doux">
                  {formaterMontant(p.montant_cents, p.devise)}
                </span>
                <span className="text-encre-doux">
                  {p.statut}
                  {p.expire_le && p.statut === 'envoyee'
                    ? ` · expire le ${dateCourte(p.expire_le)}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucune proposition émise.</p>
          </Carte>
        )}

        <FormulaireProposition
          leadId={lead.id}
          formations={catalogue.data ?? []}
          sansCompte={!lead.user_id}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Accès en cours</h2>
        {inscriptions.data?.length ? (
          <ul className={`${LISTE} text-sm`}>
            {inscriptions.data.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                <span className="font-medium">{i.formations?.titre ?? 'Formation'}</span>
                <span className="text-encre-doux">
                  {i.formations?.modalite === 'individuel' ? 'Individuel' : 'Groupe'} · {i.statut} ·{' '}
                  {/* `null` veut dire illimité, jamais « pas de date ». */}
                  {i.date_fin_acces ? `jusqu’au ${dateCourte(i.date_fin_acces)}` : 'accès illimité'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucun accès ouvert — prospect avant achat.</p>
          </Carte>
        )}
      </section>

      {(notes.data?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Notes de suivi</h2>
          <ul className="space-y-2 text-sm">
            {notes.data!.map((n) => (
              <li key={n.id} className="rounded-carte border border-filet bg-fond p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold tracking-wide text-encre-faible uppercase">
                    {n.type}
                  </span>
                  <span className="text-xs text-encre-doux">
                    {n.visible_client ? 'Visible par le client' : 'Interne'} ·{' '}
                    {dateCourte(n.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{n.contenu}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
