import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formaterMontant } from '@apex/db';

import { EnTete, Pastille, Tableau, Vide } from '@/components/admin';
import { SOURCES, libelleStatut, tonStatut } from '@/lib/crm/pipeline';
import { dateCourte, dateHeure } from '@/lib/format';
import { libelle } from '@/lib/qualification/questionnaire';
import { createClient } from '@/lib/supabase/server';

import { FormulaireFiche } from './formulaire-fiche';

/**
 * `/admin/crm/leads/[id]` — la fiche complète d'un prospect.
 *
 * Elle montre ce que la fiche formateur cache volontairement : les montants,
 * les commandes, l'historique complet. C'est la différence entre les deux
 * écrans, et elle n'est pas décorative — un formateur ne voit jamais un
 * montant, un admin doit tout voir.
 *
 * L'historique est en bas et non en haut : on ouvre une fiche pour agir, pas
 * pour lire. Ce qui demande une décision — l'affectation, le statut — passe
 * donc en premier.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from('leads')
    .select(
      'id, prenom, nom, email, telephone, statut, source, utm, created_at, user_id, assigned_to, zone_geo, tranche_age, situation_pro, niveau_trading, prop_firm, blocage, tranche_budget, delai_objectif, eligible, produit_souhaite_id, produit_recommande_id',
    )
    .eq('id', id)
    .maybeSingle();

  if (!lead) notFound();

  const [evenements, rdv, propositions, formateurs, inscriptions] = await Promise.all([
    supabase
      .from('lead_events')
      .select('id, type, payload, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('appointments')
      .select('id, debut, statut, issue, compte_rendu')
      .eq('lead_id', lead.id)
      .order('debut', { ascending: false }),
    supabase
      .from('propositions')
      .select('id, statut, montant_cents, devise, expire_le, created_at, formations(titre)')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false }),
    // Les formateurs affectables. `user_roles` est lisible par le staff, et
    // c'est bien la table des rôles qui fait foi — jamais une colonne de
    // `profiles`.
    supabase
      .from('user_roles')
      // Hint explicite : `user_roles` a deux clés vers `profiles` (`user_id` et
      // `granted_by`), l'embed serait ambigu sans dire laquelle suivre.
      .select('user_id, profiles!user_roles_user_id_fkey(id, prenom, nom)')
      .eq('role', 'formateur'),
    lead.user_id
      ? supabase
          .from('inscriptions')
          .select('id, statut, date_debut, date_fin_acces, formations(titre)')
          .eq('user_id', lead.user_id)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const listeFormateurs = (formateurs.data ?? [])
    .map((r) => ({
      id: r.profiles?.id ?? r.user_id,
      nom: [r.profiles?.prenom, r.profiles?.nom].filter(Boolean).join(' ') || 'Sans nom',
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  const reponses: Array<[string, string, string | null]> = [
    ['Budget déclaré', 'tranche_budget', lead.tranche_budget],
    ['Blocage', 'blocage', lead.blocage],
    ['Niveau', 'niveau_trading', lead.niveau_trading],
    ['Délai visé', 'delai_objectif', lead.delai_objectif],
    ['Prop firm', 'prop_firm', lead.prop_firm],
    ['Situation', 'situation_pro', lead.situation_pro],
    ['Zone', 'zone_geo', lead.zone_geo],
    ['Âge', 'tranche_age', lead.tranche_age],
  ];

  return (
    <>
      <EnTete
        titre={[lead.prenom, lead.nom].filter(Boolean).join(' ') || 'Sans nom'}
        description={`${lead.email}${lead.telephone ? ` · ${lead.telephone}` : ''} — arrivé via ${
          SOURCES[lead.source] ?? lead.source
        } le ${dateCourte(lead.created_at)}`}
        action={<Pastille ton={tonStatut(lead.statut)}>{libelleStatut(lead.statut)}</Pastille>}
      />

      <section className="space-y-3 rounded-carte border border-filet bg-fond p-5">
        <h2 className="text-sm font-semibold">Affectation et suivi</h2>
        <FormulaireFiche
          leadId={lead.id}
          affecteA={lead.assigned_to}
          statut={lead.statut}
          formateurs={listeFormateurs}
        />
        {/* Dit à voix haute ce que le champ fait vraiment, parce que l'écran
            ne le montre pas : c'est lui qui ouvre ou referme un accès. */}
        <p className="text-xs text-encre-doux">
          L’affectation décide de ce que le formateur voit dans son espace. La retirer lui referme
          l’accès à cette fiche.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-encre-doux">Ce qu’il a répondu</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-carte border border-filet bg-fond p-5 text-sm sm:grid-cols-4">
          {reponses.map(([titre, champ, valeur]) => (
            <div key={champ} className="space-y-0.5">
              <dt className="text-xs tracking-wide text-encre-faible uppercase">{titre}</dt>
              <dd>{libelle(champ, valeur)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-encre-doux">Propositions</h2>
        {propositions.data?.length ? (
          <div className="rounded-carte border border-filet bg-fond p-5">
            <Tableau colonnes={['Produit', 'Montant', 'Statut', 'Expire le']} largeurMin="34rem">
              {propositions.data.map((p) => (
                <tr key={p.id} className="border-b border-filet last:border-0">
                  <td className="py-2.5 pr-4">{p.formations?.titre ?? '—'}</td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    {formaterMontant(p.montant_cents, p.devise)}
                  </td>
                  <td className="py-2.5 pr-4">{p.statut}</td>
                  <td className="py-2.5 text-encre-doux">{dateCourte(p.expire_le)}</td>
                </tr>
              ))}
            </Tableau>
          </div>
        ) : (
          <Vide>Aucune proposition émise.</Vide>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-encre-doux">Accès ouverts</h2>
        {inscriptions.data?.length ? (
          <div className="rounded-carte border border-filet bg-fond p-5">
            <Tableau colonnes={['Produit', 'Statut', 'Depuis', 'Jusqu’au']} largeurMin="34rem">
              {inscriptions.data.map((i) => (
                <tr key={i.id} className="border-b border-filet last:border-0">
                  <td className="py-2.5 pr-4">{i.formations?.titre ?? '—'}</td>
                  <td className="py-2.5 pr-4">{i.statut}</td>
                  <td className="py-2.5 pr-4 text-encre-doux">{dateCourte(i.date_debut)}</td>
                  <td className="py-2.5 text-encre-doux">
                    {/* `null` veut dire illimité, jamais « non renseigné ». */}
                    {i.date_fin_acces ? dateCourte(i.date_fin_acces) : 'illimité'}
                  </td>
                </tr>
              ))}
            </Tableau>
          </div>
        ) : (
          <Vide>Aucun accès ouvert — prospect avant achat.</Vide>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-encre-doux">Rendez-vous</h2>
        {rdv.data?.length ? (
          <ul className="space-y-2">
            {rdv.data.map((r) => (
              <li key={r.id} className="rounded-carte border border-filet bg-fond p-4 text-sm">
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
          <Vide>Aucun rendez-vous.</Vide>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-encre-doux">Historique</h2>
        {evenements.data?.length ? (
          <div className="rounded-carte border border-filet bg-fond p-5">
            {/* `lead_events` est un journal append-only : aucune politique
                d'UPDATE ni de DELETE n'existe pour cette table, ce qui la rend
                réellement immuable. C'est la source de vérité quand une fiche
                et son histoire se contredisent. */}
            <Tableau colonnes={['Quand', 'Événement', 'Détail']}>
              {evenements.data.map((e) => (
                <tr key={e.id} className="border-b border-filet align-top last:border-0">
                  <td className="py-2.5 pr-4 whitespace-nowrap text-encre-doux">
                    {dateHeure(e.created_at)}
                  </td>
                  <td className="py-2.5 pr-4 font-medium">{e.type}</td>
                  <td className="py-2.5 text-encre-doux">
                    {typeof e.payload === 'object' && e.payload !== null
                      ? Object.entries(e.payload as Record<string, unknown>)
                          .map(([cle, valeur]) => `${cle} : ${String(valeur)}`)
                          .join(' · ')
                      : '—'}
                  </td>
                </tr>
              ))}
            </Tableau>
          </div>
        ) : (
          <Vide>Aucun événement enregistré.</Vide>
        )}
      </section>

      <p className="text-sm">
        <Link href="/admin/crm/leads" className="text-accent hover:underline">
          ← Retour aux prospects
        </Link>
      </p>
    </>
  );
}
