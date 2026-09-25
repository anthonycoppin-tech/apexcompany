import Link from 'next/link';

import { rolesConnus } from '@apex/db';

import { EnTete, Tableau, Vide } from '@/components/admin';
import { libelleProfilFormateur } from '@/lib/auth/profils';
import { getUserRoles } from '@/lib/auth/roles';
import { dateCourte } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

import { AjoutMembre } from './ajout-membre';
import { BoutonsRole } from './boutons-role';

/** Au-delà, la vue demande une recherche plutôt que d'afficher toute la clientèle. */
const PLAFOND = 50;

const VUES = [
  { valeur: 'equipe', libelle: 'Équipe' },
  { valeur: 'formateurs', libelle: 'Formateurs' },
  { valeur: 'admins', libelle: 'Admins et owners' },
  { valeur: 'clients', libelle: 'Clients' },
  { valeur: 'tous', libelle: 'Tous' },
] as const;

type Vue = (typeof VUES)[number]['valeur'];

/**
 * `/admin/utilisateurs` — les comptes et leurs rôles.
 *
 * Lisible par le staff, **modifiable par le seul `owner`** — imposé par la
 * politique `user_roles_owner_ecrit`, pas par cet écran. Les boutons désactivés
 * pour un admin sont du confort d'interface ; la garantie est dans le moteur.
 *
 * **L'équipe par défaut** (25 septembre 2026) : la page mêlait l'équipe à tous
 * les clients, alors que c'est l'équipe dont on gère les rôles — un client n'a
 * que le sien, posé à la création. Les clients restent à un filtre, avec une
 * recherche, et les plus récents d'abord ; leur fiche est dans « Clients ».
 *
 * Rappel en lisant ce tableau : **ces rôles n'ont rien à voir avec les rôles
 * Discord.** Le rôle `invité` est un rôle Discord et n'apparaît donc pas ici.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string; q?: string }>;
}) {
  const parametres = await searchParams;
  const vue: Vue = VUES.find((v) => v.valeur === parametres.vue)?.valeur ?? 'equipe';
  const recherche = (parametres.q ?? '').trim().toLowerCase();

  const supabase = await createClient();
  const mesRoles = await getUserRoles();
  const estOwner = mesRoles.includes('owner');

  const [{ data: profils }, { data: attributions }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, prenom, nom, email, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('user_roles').select('user_id, role'),
  ]);

  const rolesParCompte = new Map<string, string[]>();
  for (const a of attributions ?? []) {
    rolesParCompte.set(a.user_id, [...(rolesParCompte.get(a.user_id) ?? []), a.role]);
  }
  const rolesDe = (id: string) => rolesParCompte.get(id) ?? [];
  const aUn = (id: string, ...roles: string[]) => rolesDe(id).some((r) => roles.includes(r));

  const tous = profils ?? [];
  const filtres: Record<Vue, (id: string) => boolean> = {
    equipe: (id) => aUn(id, 'formateur', 'admin', 'owner'),
    formateurs: (id) => aUn(id, 'formateur'),
    admins: (id) => aUn(id, 'admin', 'owner'),
    clients: (id) => aUn(id, 'client'),
    tous: () => true,
  };
  const compte = (v: Vue) => tous.filter((p) => filtres[v](p.id)).length;

  const correspondants = tous
    .filter((p) => filtres[vue](p.id))
    .filter(
      (p) =>
        !recherche ||
        [p.prenom, p.nom, p.email].some((champ) => champ?.toLowerCase().includes(recherche)),
    );
  const liste = correspondants.slice(0, PLAFOND);
  const nbOwners = tous.filter((p) => aUn(p.id, 'owner')).length;

  const lienVue = (v: Vue) =>
    `/admin/utilisateurs?${new URLSearchParams(recherche ? { vue: v, q: recherche } : { vue: v })}`;

  return (
    <>
      <EnTete
        titre="Comptes et rôles"
        description={`${compte('equipe')} dans l’équipe · ${compte('clients')} clients`}
        action={
          estOwner ? undefined : (
            <span className="text-xs text-encre-doux">
              Lecture seule — seul un owner modifie les rôles
            </span>
          )
        }
      />

      {nbOwners < 2 && (
        // Un seul owner, c'est un point de défaillance unique : s'il perd son
        // accès, plus personne ne peut attribuer un rôle, et il n'existe pas
        // d'écran de secours.
        <p className="rounded-carte border border-filet bg-fond p-4 text-sm text-encre-doux">
          Un seul compte owner. En prévoir un second évite de se retrouver sans personne pour gérer
          les rôles le jour où celui-ci perd son accès.
        </p>
      )}

      {/* Les deux profils de formateur (25 septembre 2026) ne sont pas deux
          rôles : c'est la présence d'Admin à côté de Formateur qui les
          distingue, et ce que « tout » veut dire reste défini par la RLS du
          staff. */}
      <p className="rounded-carte border border-filet bg-fond p-4 text-sm leading-relaxed text-encre-doux">
        <strong className="text-encre">Formateur admin</strong> = Formateur + Admin : accès à tout,
        statistiques et back-office compris.{' '}
        <strong className="text-encre">Formateur employé</strong> = Formateur seul : ses prospects
        et ses accompagnements, sans argent ni statistiques.
      </p>

      {estOwner && <AjoutMembre />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Filtrer les comptes">
          {VUES.map((v) => (
            <Link
              key={v.valeur}
              href={lienVue(v.valeur)}
              aria-current={v.valeur === vue ? 'page' : undefined}
              className={`rounded-douce border px-3 py-1.5 text-sm ${
                v.valeur === vue
                  ? 'border-encre bg-encre text-fond'
                  : 'border-filet text-encre-doux hover:bg-fond'
              }`}
            >
              {v.libelle} <span className="tabular-nums opacity-70">{compte(v.valeur)}</span>
            </Link>
          ))}
        </nav>

        {/* Un formulaire en GET : l'URL filtrée se garde et s'envoie. */}
        <form method="get" className="flex gap-2">
          <input type="hidden" name="vue" value={vue} />
          <input
            type="search"
            name="q"
            defaultValue={parametres.q ?? ''}
            placeholder="Nom ou email"
            aria-label="Rechercher un compte"
            className="rounded-douce border border-filet px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-douce border border-filet px-3 py-1.5 text-sm text-encre-doux hover:bg-fond"
          >
            Rechercher
          </button>
        </form>
      </div>

      {liste.length ? (
        <div className="space-y-3 rounded-carte border border-filet bg-fond p-5">
          <Tableau colonnes={['Personne', 'Rôles', 'Compte créé le']} largeurMin="46rem">
            {liste.map((p) => {
              const roles = rolesDe(p.id);
              const profil = libelleProfilFormateur(rolesConnus(roles));
              const nom = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Sans nom';
              return (
                <tr key={p.id} className="border-b border-filet align-top last:border-0">
                  <td className="py-3 pr-4">
                    {roles.includes('client') ? (
                      <Link href={`/admin/clients/${p.id}`} className="font-medium hover:underline">
                        {nom}
                      </Link>
                    ) : (
                      <span className="font-medium">{nom}</span>
                    )}
                    <span className="block text-xs text-encre-faible">{p.email}</span>
                    {profil && (
                      <span className="mt-1 block text-xs font-medium text-accent">{profil}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <BoutonsRole userId={p.id} roles={roles} estOwner={estOwner} />
                  </td>
                  <td className="py-3 whitespace-nowrap text-encre-doux">
                    {dateCourte(p.created_at)}
                  </td>
                </tr>
              );
            })}
          </Tableau>
          {correspondants.length > PLAFOND && (
            <p className="text-sm text-encre-doux">
              Les {PLAFOND} plus récents sur {correspondants.length}. Cherchez par nom ou email pour
              trouver les autres.
            </p>
          )}
        </div>
      ) : (
        <Vide>{recherche ? 'Aucun compte ne correspond à cette recherche.' : 'Aucun compte.'}</Vide>
      )}
    </>
  );
}
