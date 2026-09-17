import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Pastille } from '@/components/admin';
import { Coordonnees } from '@/components/coordonnees';
import { dateCourte } from '@/lib/format';
import {
  STATUTS_INSCRIPTION,
  joursRestants,
  nomComplet,
  type TypeNote,
} from '@/lib/formateur/suivi';
import { libelle } from '@/lib/qualification/questionnaire';
import { createClient } from '@/lib/supabase/server';

import { FormulaireNote, ListeNotes } from '../notes';

/**
 * `/formateur/accompagnements/[id]` — un client suivi, et le carnet de suivi
 * qui va avec.
 *
 * L'identifiant est celui de l'**inscription** : c'est elle qui est confiée au
 * formateur, et la RLS ne laisse lire que les siennes — un identifiant tapé à la
 * main répond 404, qu'il existe ou non.
 *
 * Ce que le client a répondu au formulaire n'apparaît que si le formateur a
 * aussi la fiche du prospect : `leads` reste cloisonné sur `assigned_to`, et on
 * n'élargit pas ce cloisonnement pour un confort d'affichage.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inscription } = await supabase
    .from('inscriptions')
    .select(
      'id, user_id, statut, date_debut, date_fin_acces, formations(titre, modalite, type_produit, duree_semaines, volume_horaire)',
    )
    .eq('id', id)
    .maybeSingle();

  if (!inscription) notFound();

  const [personne, notes, fiche, autres] = await Promise.all([
    supabase
      .from('profiles')
      .select('prenom, nom, email, telephone')
      .eq('id', inscription.user_id)
      .maybeSingle(),
    supabase
      .from('suivi_notes')
      .select('id, type, contenu, visible_client, created_at, formateur_id')
      .eq('inscription_id', inscription.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('leads')
      .select(
        'id, telephone, tranche_budget, blocage, niveau_trading, prop_firm, situation_pro, delai_objectif',
      )
      .eq('user_id', inscription.user_id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('inscriptions')
      .select('id, statut, date_fin_acces, formations(titre)')
      .eq('user_id', inscription.user_id)
      .neq('id', inscription.id),
  ]);

  const toutesNotes = (notes.data ?? []).map((n) => ({ ...n, type: n.type as TypeNote }));
  const objectif = toutesNotes.find((n) => n.type === 'objectif');
  const restants = joursRestants(inscription.date_fin_acces);
  const f = inscription.formations;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <Link href="/formateur/accompagnements" className="text-sm text-encre-doux hover:underline">
          ← Mes accompagnements
        </Link>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold">
              {nomComplet(personne.data, personne.data?.email ?? 'Client')}
            </h1>
            <Pastille ton={inscription.statut === 'active' ? 'bon' : 'neutre'}>
              {STATUTS_INSCRIPTION[inscription.statut]}
            </Pastille>
          </div>
          <p className="text-sm text-encre-doux">
            {f?.titre ?? 'Programme'} · {f?.modalite === 'individuel' ? 'individuel' : 'en groupe'}
            {f?.duree_semaines ? ` · ${f.duree_semaines} semaines` : ''}
            {f?.volume_horaire ? ` · ${f.volume_horaire} h prévues` : ''}
          </p>
          <p className="text-sm text-encre-doux">
            Depuis le {dateCourte(inscription.date_debut)} ·{' '}
            {restants === null
              ? 'accès illimité'
              : restants < 0
                ? `accès terminé le ${dateCourte(inscription.date_fin_acces)}`
                : `${restants} jour${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''}, jusqu’au ${dateCourte(inscription.date_fin_acces)}`}
          </p>
        </div>

        {/* Le téléphone est saisi au formulaire, donc sur la fiche prospect ; le
            profil ne l'a pas toujours. */}
        <Coordonnees
          telephone={personne.data?.telephone ?? fiche.data?.telephone}
          email={personne.data?.email}
        />

        {objectif ? (
          <div className="rounded-douce border border-accent/30 bg-accent-doux px-4 py-3 text-sm">
            <p className="font-semibold">
              Objectif en cours · fixé le {dateCourte(objectif.created_at)}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{objectif.contenu}</p>
          </div>
        ) : (
          inscription.statut === 'active' && (
            <p className="rounded-douce border border-dashed border-filet px-4 py-3 text-sm text-encre-doux">
              Aucun objectif fixé. Un objectif écrit ci-dessous, visible par le client, lui donne un
              cap dans son espace.
            </p>
          )
        )}
      </header>

      {fiche.data && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Son point de départ</h2>
            <Link
              href={`/formateur/clients/${fiche.data.id}`}
              className="text-sm font-semibold text-accent hover:underline"
            >
              Fiche commerciale →
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-carte border border-filet bg-fond p-5 text-sm sm:grid-cols-3">
            {(
              [
                ['Blocage principal', 'blocage', fiche.data.blocage],
                ['Niveau', 'niveau_trading', fiche.data.niveau_trading],
                ['Prop firm', 'prop_firm', fiche.data.prop_firm],
                ['Situation', 'situation_pro', fiche.data.situation_pro],
                ['Délai visé', 'delai_objectif', fiche.data.delai_objectif],
                ['Budget déclaré', 'tranche_budget', fiche.data.tranche_budget],
              ] as const
            ).map(([titre, champ, valeur]) => (
              <div key={champ} className="space-y-0.5">
                <dt className="text-xs font-semibold tracking-wide text-encre-faible uppercase">
                  {titre}
                </dt>
                <dd>{libelle(champ, valeur)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Carnet de suivi</h2>
          <p className="text-sm text-encre-doux">
            Objectifs, retours de séance, observations. Les séances se planifient avec le client,
            hors du site ; ce carnet garde ce qui s’y est dit.
          </p>
        </div>
        {inscription.statut === 'active' && <FormulaireNote inscriptionId={inscription.id} />}
        <ListeNotes notes={toutesNotes} moi={user?.id ?? null} />
      </section>

      {(autres.data?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Ses autres programmes avec vous</h2>
          <ul className="space-y-2 text-sm">
            {autres.data!.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/formateur/accompagnements/${a.id}`}
                  className="flex flex-wrap justify-between gap-2 rounded-carte border border-filet bg-fond p-3 hover:bg-surface"
                >
                  <span className="font-medium">{a.formations?.titre ?? 'Programme'}</span>
                  <span className="text-encre-doux">
                    {STATUTS_INSCRIPTION[a.statut]}
                    {a.date_fin_acces ? ` · jusqu’au ${dateCourte(a.date_fin_acces)}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
