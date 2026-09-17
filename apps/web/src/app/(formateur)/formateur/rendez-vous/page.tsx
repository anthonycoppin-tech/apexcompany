import Link from 'next/link';

import { Pastille } from '@/components/admin';
import { Coordonnees } from '@/components/coordonnees';
import { Carte } from '@/components/ui';
import { dateHeure, heure } from '@/lib/format';
import { ISSUES_RDV, STATUTS, nomComplet } from '@/lib/formateur/suivi';
import { libelle } from '@/lib/qualification/questionnaire';
import { createClient } from '@/lib/supabase/server';

import { FormulaireIssue } from './formulaire-issue';

const HISTORIQUE = 30;

/**
 * `/formateur/rendez-vous` — les audits, dans l'ordre où ils demandent quelque
 * chose.
 *
 * 1. **À consigner** : les audits passés sans issue. C'est la seule chose que
 *    l'écran réclame, et tant qu'elle manque, les statistiques mentent.
 * 2. **À venir** : chaque audit avec de quoi joindre la personne — un retard,
 *    un lien qui ne marche pas, et c'est le téléphone qu'on cherche — et ce
 *    qu'elle a déclaré, pour arriver préparé.
 * 3. **Historique** : les issues déjà consignées, corrigibles.
 */
export default async function Page() {
  const supabase = await createClient();
  const maintenant = new Date().toISOString();

  const [passes, aVenir] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, debut, statut, issue, compte_rendu, leads(id, prenom, nom, email, telephone)')
      .lt('debut', maintenant)
      .order('debut', { ascending: false })
      .limit(100),
    supabase
      .from('appointments')
      .select(
        'id, debut, fin, statut, leads(id, prenom, nom, email, telephone, statut, tranche_budget, blocage, niveau_trading, delai_objectif)',
      )
      .gte('debut', maintenant)
      .neq('statut', 'annule')
      .order('debut'),
  ]);

  const tousPasses = (passes.data ?? []).filter((r) => r.statut !== 'annule' || r.issue);
  const aConsigner = tousPasses.filter((r) => !r.issue);
  const consignes = tousPasses.filter((r) => r.issue).slice(0, HISTORIQUE);

  // Regroupés par jour : « jeudi 18 septembre », puis les heures. C'est la
  // lecture d'un agenda, et elle évite de répéter la date sur chaque ligne.
  const parJour = new Map<string, NonNullable<typeof aVenir.data>>();
  for (const r of aVenir.data ?? []) {
    const jour = new Date(r.debut).toLocaleDateString('fr-FR', {
      timeZone: 'Europe/Paris',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    parJour.set(jour, [...(parJour.get(jour) ?? []), r]);
  }

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold">Mes rendez-vous</h1>
        <p className="text-encre-doux">
          {aVenir.data?.length ?? 0} audit{(aVenir.data?.length ?? 0) > 1 ? 's' : ''} à venir
          {aConsigner.length > 0 && ` · ${aConsigner.length} sans issue consignée`}
        </p>
      </div>

      {aConsigner.length > 0 && (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold">À consigner</h2>
            <p className="text-sm text-encre-doux">
              Honoré, absent ou annulé : sans cette issue, le taux de présence et l’entonnoir sont
              faux.
            </p>
          </div>
          <ul className="space-y-4">
            {aConsigner.map((rdv) => (
              <li key={rdv.id}>
                <Carte className="space-y-3 border-alerte/40">
                  <EnTeteRdv rdv={rdv} />
                  <FormulaireIssue id={rdv.id} issue={rdv.issue} compteRendu={rdv.compte_rendu} />
                </Carte>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-bold">À venir</h2>
        {parJour.size ? (
          [...parJour].map(([jour, rdvs]) => (
            <div key={jour} className="space-y-2">
              <h3 className="text-sm font-semibold text-encre-doux first-letter:uppercase">
                {jour}
              </h3>
              <ul className="space-y-3">
                {rdvs.map((rdv) => {
                  const l = rdv.leads;
                  return (
                    <li key={rdv.id}>
                      <Carte className="space-y-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-semibold">
                            <span className="mr-3 tabular-nums">
                              {heure(rdv.debut)}
                              {rdv.fin ? `–${heure(rdv.fin)}` : ''}
                            </span>
                            {l ? nomComplet(l) : 'Réservation sans fiche prospect'}
                          </p>
                          {l && (
                            <span className="flex items-center gap-3">
                              <Pastille>{STATUTS[l.statut]}</Pastille>
                              <Link
                                href={`/formateur/clients/${l.id}`}
                                className="text-sm font-semibold text-accent hover:underline"
                              >
                                Préparer →
                              </Link>
                            </span>
                          )}
                        </div>
                        {l && (
                          <>
                            <p className="text-sm text-encre-doux">
                              {[
                                libelle('tranche_budget', l.tranche_budget),
                                libelle('blocage', l.blocage),
                                libelle('niveau_trading', l.niveau_trading),
                                libelle('delai_objectif', l.delai_objectif),
                              ].join(' · ')}
                            </p>
                            <Coordonnees telephone={l.telephone} email={l.email} compact />
                          </>
                        )}
                      </Carte>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        ) : (
          <Carte>
            <p className="text-encre-doux">
              Aucun audit à venir. Les réservations arrivent ici dès qu’elles sont prises sur
              Cal.com.
            </p>
          </Carte>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Historique</h2>
          <p className="text-sm text-encre-doux">
            Les {HISTORIQUE} derniers audits consignés. Une issue se corrige ici.
          </p>
        </div>
        {consignes.length ? (
          <ul className="space-y-4">
            {consignes.map((rdv) => (
              <li key={rdv.id}>
                <details className="group rounded-carte border border-filet bg-fond">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
                    <EnTeteRdv rdv={rdv} />
                  </summary>
                  <div className="border-t border-filet p-4">
                    <FormulaireIssue id={rdv.id} issue={rdv.issue} compteRendu={rdv.compte_rendu} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">Aucun audit consigné pour l’instant.</p>
          </Carte>
        )}
      </section>
    </div>
  );
}

function EnTeteRdv({
  rdv,
}: {
  rdv: {
    debut: string;
    issue: keyof typeof ISSUES_RDV | null;
    leads: {
      id: string;
      prenom: string | null;
      nom: string | null;
      telephone: string | null;
    } | null;
  };
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <span className="font-semibold">
        {rdv.leads ? (
          <Link href={`/formateur/clients/${rdv.leads.id}`} className="text-accent hover:underline">
            {nomComplet(rdv.leads)}
          </Link>
        ) : (
          'Réservation sans fiche prospect'
        )}
      </span>
      <span className="flex items-center gap-3 text-sm text-encre-doux">
        {rdv.leads?.telephone && (
          <a href={`tel:${rdv.leads.telephone.replace(/\s/g, '')}`} className="hover:underline">
            {rdv.leads.telephone}
          </a>
        )}
        {dateHeure(rdv.debut)}
        {rdv.issue && (
          <Pastille ton={rdv.issue === 'honore' ? 'bon' : 'neutre'}>
            {ISSUES_RDV[rdv.issue]}
          </Pastille>
        )}
      </span>
    </div>
  );
}
