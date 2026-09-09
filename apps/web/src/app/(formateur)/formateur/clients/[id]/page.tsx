import { notFound } from 'next/navigation';

import { formaterMontant } from '@apex/db';

import { Carte, LISTE } from '@/components/ui';
import { dateCourte, dateHeure } from '@/lib/format';
import { libelle } from '@/lib/qualification/questionnaire';
import { createClient } from '@/lib/supabase/server';

import { FormulaireProposition } from './formulaire-proposition';

/**
 * `/formateur/clients/[id]` — la fiche qui prépare l'appel.
 *
 * En tête, ce que le formulaire a capté : budget déclaré, blocage principal,
 * niveau, délai. C'est ce qui oriente la recommandation, et c'est disponible
 * gratuitement puisque la personne vient de le saisir.
 *
 * **Jamais un montant.** Ni prix payé, ni facture, ni impayé. Le formateur voit
 * si l'accès est actif, pas ce qu'il a coûté — et ce n'est pas cet écran qui le
 * garantit, ce sont les politiques RLS : les tables `orders`, `payments`,
 * `invoices` et `subscriptions` ne lui sont tout simplement pas ouvertes.
 *
 * L'identifiant est celui du **prospect**, pas du compte : une personne qui n'a
 * jamais acheté a une fiche, et c'est même le cas le plus fréquent au moment de
 * l'audit.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from('leads')
    // Un seul littéral, sans concaténation : supabase-js déduit le type des
    // lignes de la chaîne elle-même, et un `+` la réduit à `string`, ce qui
    // fait perdre le typage de tout ce qui suit.
    .select(
      'id, prenom, nom, email, telephone, statut, source, created_at, user_id, zone_geo, tranche_age, situation_pro, niveau_trading, prop_firm, blocage, tranche_budget, delai_objectif, eligible',
    )
    .eq('id', id)
    .maybeSingle();

  // Introuvable ou hors périmètre : la RLS ne distingue pas les deux, et c'est
  // le bon comportement. Répondre « existe mais vous n'y avez pas droit »
  // confirmerait l'existence d'un client à un formateur qui n'a pas à le savoir.
  if (!lead) notFound();

  const [rdv, inscriptions, catalogue, propositions] = await Promise.all([
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
  ]);

  // Les notes se lisent APRÈS les inscriptions, et restreintes aux siennes.
  // La RLS ne suffit pas ici : elle limite la lecture aux notes que ce
  // formateur a le droit de voir, c'est-à-dire celles de TOUS ses clients. Sans
  // ce filtre, chaque fiche afficherait les notes de tout le monde — pas une
  // fuite, mais une fiche qui ment.
  const inscriptionIds = (inscriptions.data ?? []).map((i) => i.id);

  const notes = inscriptionIds.length
    ? await supabase
        .from('suivi_notes')
        .select('id, type, contenu, visible_client, created_at')
        .in('inscription_id', inscriptionIds)
        .order('created_at', { ascending: false })
    : { data: [] as never[] };

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

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold">
          {[lead.prenom, lead.nom].filter(Boolean).join(' ') || 'Sans nom'}
        </h1>
        <p className="text-sm text-encre-doux">
          {lead.email}
          {lead.telephone ? ` · ${lead.telephone}` : ''}
        </p>
        <p className="text-sm text-encre-doux">
          Arrivé via {lead.source} le {dateCourte(lead.created_at)}
        </p>
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
        </dl>
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
                  {/* `null` veut dire illimité, jamais « pas de date » : c'est ce
                      qui donne aux formations leur accès à vie. */}
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
        <h2 className="text-xl font-bold">Notes de suivi</h2>
        {notes.data?.length ? (
          <ul className="space-y-2 text-sm">
            {notes.data.map((n) => (
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
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucune note.</p>
          </Carte>
        )}
      </section>
    </div>
  );
}
