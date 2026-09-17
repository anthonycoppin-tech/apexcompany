import Link from 'next/link';

import { Pastille } from '@/components/admin';
import { Coordonnees } from '@/components/coordonnees';
import { Carte } from '@/components/ui';
import { dateCourte } from '@/lib/format';
import {
  JOUR_MS,
  SANS_SUIVI_JOURS,
  STATUTS_INSCRIPTION,
  depuis,
  joursRestants,
  nomComplet,
} from '@/lib/formateur/suivi';
import { createClient } from '@/lib/supabase/server';

const FIN_PROCHE_JOURS = 30;

const VUES = [
  { valeur: 'en-cours', libelle: 'En cours' },
  { valeur: 'a-reprendre', libelle: 'Suivi à reprendre' },
  { valeur: 'fin-proche', libelle: 'Se terminent bientôt' },
  { valeur: 'termines', libelle: 'Terminés' },
] as const;

type Vue = (typeof VUES)[number]['valeur'];

/**
 * `/formateur/accompagnements` — les clients qu'on suit après la vente.
 *
 * **Pourquoi un écran à part de « Prospects ».** Celui-là part du prospect, donc
 * de `leads.assigned_to` : il ne montre que les personnes qu'on a soi-même
 * vendues. Or c'est Franck qui mène les audits, et le formateur qui suit un
 * client n'est pas forcément celui qui l'a signé. L'ancrage ici est
 * l'inscription (`inscriptions.formateur_id`), la même que celle de la RLS —
 * sans cet écran, un formateur n'avait aucun moyen de retrouver un client qu'il
 * n'avait pas vendu.
 *
 * Aucun montant : ce que le client a payé n'est pas lisible par le formateur.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue } = await searchParams;
  const choisie: Vue = VUES.some((v) => v.valeur === vue) ? (vue as Vue) : 'en-cours';
  const maintenant = new Date().getTime();

  const supabase = await createClient();

  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select(
      'id, user_id, statut, date_debut, date_fin_acces, formations(titre, modalite, type_produit)',
    )
    .order('date_debut', { ascending: false });

  const tous = inscriptions ?? [];
  const comptes = [...new Set(tous.map((i) => i.user_id))];
  const ids = tous.map((i) => i.id);

  const [profils, notes, fiches] = await Promise.all([
    comptes.length
      ? supabase.from('profiles').select('id, prenom, nom, email, telephone').in('id', comptes)
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? supabase
          .from('suivi_notes')
          .select('inscription_id, type, contenu, created_at')
          .in('inscription_id', ids)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    // Le téléphone est saisi au formulaire : c'est la fiche prospect qui le
    // porte, quand le formateur y a accès.
    comptes.length
      ? supabase.from('leads').select('user_id, telephone').in('user_id', comptes)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const profil = new Map((profils.data ?? []).map((p) => [p.id, p]));
  const telephoneFiche = new Map(
    (fiches.data ?? []).filter((f) => f.telephone).map((f) => [f.user_id!, f.telephone!]),
  );
  const derniereNote = new Map<string, string>();
  const objectif = new Map<string, string>();
  for (const n of notes.data ?? []) {
    if (!derniereNote.has(n.inscription_id)) derniereNote.set(n.inscription_id, n.created_at);
    if (n.type === 'objectif' && !objectif.has(n.inscription_id)) {
      objectif.set(n.inscription_id, n.contenu);
    }
  }

  const lignes = tous.map((i) => {
    const restants = joursRestants(i.date_fin_acces, maintenant);
    const dernier = derniereNote.get(i.id) ?? null;
    const reference = dernier ?? i.date_debut;
    const individuel = i.formations?.modalite === 'individuel';
    return {
      ...i,
      restants,
      dernier,
      objectif: objectif.get(i.id) ?? null,
      personne: profil.get(i.user_id),
      aReprendre:
        i.statut === 'active' &&
        individuel &&
        maintenant - new Date(reference).getTime() > SANS_SUIVI_JOURS * JOUR_MS,
      finProche: i.statut === 'active' && restants !== null && restants <= FIN_PROCHE_JOURS,
    };
  });

  const filtres: Record<Vue, (l: (typeof lignes)[number]) => boolean> = {
    'en-cours': (l) => l.statut === 'active',
    'a-reprendre': (l) => l.aReprendre,
    'fin-proche': (l) => l.finProche,
    termines: (l) => l.statut !== 'active',
  };

  const affichees = lignes.filter(filtres[choisie]).sort((a, b) => {
    // Ce qui presse d'abord : la fin la plus proche, puis le suivi le plus ancien.
    if (choisie === 'fin-proche') return (a.restants ?? 0) - (b.restants ?? 0);
    if (choisie === 'a-reprendre') return (a.dernier ?? '').localeCompare(b.dernier ?? '');
    return 0;
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold">Mes accompagnements</h1>
        <p className="text-encre-doux">
          Les clients qui vous sont confiés, avec leurs objectifs et vos notes de suivi.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Vue">
        {VUES.map((v) => (
          <Link
            key={v.valeur}
            href={`/formateur/accompagnements?vue=${v.valeur}`}
            aria-current={v.valeur === choisie ? 'page' : undefined}
            className={`rounded-douce border px-3 py-1.5 text-sm ${
              v.valeur === choisie
                ? 'border-encre bg-encre text-white'
                : 'border-filet text-encre-doux hover:bg-fond'
            }`}
          >
            {v.libelle} · {lignes.filter(filtres[v.valeur]).length}
          </Link>
        ))}
      </nav>

      {affichees.length ? (
        <ul className="space-y-3">
          {affichees.map((l) => (
            <li key={l.id}>
              <Carte className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Link
                      href={`/formateur/accompagnements/${l.id}`}
                      className="text-lg font-bold hover:underline"
                    >
                      {nomComplet(l.personne, l.personne?.email ?? 'Client')}
                    </Link>
                    <p className="text-sm text-encre-doux">
                      {l.formations?.titre ?? 'Programme'} ·{' '}
                      {l.formations?.modalite === 'individuel' ? 'individuel' : 'en groupe'} ·
                      depuis le {dateCourte(l.date_debut)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {l.statut !== 'active' && <Pastille>{STATUTS_INSCRIPTION[l.statut]}</Pastille>}
                    {l.aReprendre && <Pastille ton="attente">Suivi à reprendre</Pastille>}
                    {l.statut === 'active' && (
                      <Pastille ton={l.finProche ? 'attente' : 'neutre'}>
                        {l.restants === null
                          ? 'Accès illimité'
                          : l.restants < 0
                            ? `Terminé le ${dateCourte(l.date_fin_acces)}`
                            : `${l.restants} j restants · ${dateCourte(l.date_fin_acces)}`}
                      </Pastille>
                    )}
                  </div>
                </div>

                {l.objectif && (
                  <p className="line-clamp-2 text-sm">
                    <span className="font-semibold">Objectif · </span>
                    {l.objectif}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Coordonnees
                    telephone={l.personne?.telephone ?? telephoneFiche.get(l.user_id)}
                    email={l.personne?.email}
                    compact
                  />
                  <span className="text-xs text-encre-doux">
                    Dernier suivi {l.dernier ? depuis(l.dernier, maintenant) : 'jamais'}
                  </span>
                </div>
              </Carte>
            </li>
          ))}
        </ul>
      ) : (
        <Carte>
          <p className="text-encre-doux">
            {choisie === 'en-cours'
              ? 'Aucun accompagnement en cours ne vous est confié pour l’instant.'
              : choisie === 'a-reprendre'
                ? `Tous vos accompagnements individuels ont une note de moins de ${SANS_SUIVI_JOURS} jours.`
                : choisie === 'fin-proche'
                  ? `Aucun accès ne se termine dans les ${FIN_PROCHE_JOURS} prochains jours.`
                  : 'Aucun accompagnement terminé.'}
          </p>
        </Carte>
      )}
    </div>
  );
}
