import { EnTete, Tableau, Tuile, Vide } from '@/components/admin';
import { getUserRoles } from '@/lib/auth/roles';
import { dateCourte } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

import { BoutonsRole } from './boutons-role';

/**
 * `/admin/utilisateurs` — les comptes et leurs rôles.
 *
 * Lisible par le staff, **modifiable par le seul `owner`** — imposé par la
 * politique `user_roles_owner_ecrit`, pas par cet écran. Les boutons désactivés
 * pour un admin sont du confort d'interface ; la garantie est dans le moteur.
 *
 * Rappel en lisant ce tableau : **ces rôles n'ont rien à voir avec les rôles
 * Discord.** Ici on décide de ce qu'une requête peut lire dans la base. Là-bas,
 * de ce qu'une personne voit comme contenu. Le rôle `invité`, attribué à la
 * création du compte, est un rôle Discord et n'apparaît donc pas ici.
 */
export default async function Page() {
  const supabase = await createClient();
  const mesRoles = await getUserRoles();
  const estOwner = mesRoles.includes('owner');

  const [{ data: profils }, { data: attributions }] = await Promise.all([
    supabase.from('profiles').select('id, prenom, nom, email, created_at').order('created_at'),
    supabase.from('user_roles').select('user_id, role'),
  ]);

  const rolesDe = (id: string) =>
    (attributions ?? []).filter((a) => a.user_id === id).map((a) => a.role as string);

  const compteParRole = (role: string) =>
    (attributions ?? []).filter((a) => a.role === role).length;

  const liste = profils ?? [];

  return (
    <>
      <EnTete
        titre="Comptes et rôles"
        description={`${liste.length} comptes`}
        action={
          estOwner ? undefined : (
            <span className="text-xs text-encre-doux">
              Lecture seule — seul un owner modifie les rôles
            </span>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tuile libelle="Clients" valeur={String(compteParRole('client'))} />
        <Tuile libelle="Formateurs" valeur={String(compteParRole('formateur'))} />
        <Tuile libelle="Admins" valeur={String(compteParRole('admin'))} />
        <Tuile
          libelle="Owners"
          valeur={String(compteParRole('owner'))}
          detail="peuvent gérer les rôles"
          ton={compteParRole('owner') < 2 ? 'attente' : 'neutre'}
        />
      </div>

      {compteParRole('owner') < 2 && (
        // Un seul owner, c'est un point de défaillance unique : s'il perd son
        // accès, plus personne ne peut attribuer un rôle, et il n'existe pas
        // d'écran de secours.
        <p className="rounded-carte border border-filet bg-fond p-4 text-sm text-encre-doux">
          Un seul compte owner. En prévoir un second évite de se retrouver sans personne pour gérer
          les rôles le jour où celui-ci perd son accès.
        </p>
      )}

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau colonnes={['Personne', 'Rôles', 'Compte créé le']} largeurMin="46rem">
            {liste.map((p) => (
              <tr key={p.id} className="border-b border-filet align-top last:border-0">
                <td className="py-3 pr-4">
                  <span className="font-medium">
                    {[p.prenom, p.nom].filter(Boolean).join(' ') || 'Sans nom'}
                  </span>
                  <span className="block text-xs text-encre-faible">{p.email}</span>
                </td>
                <td className="py-3 pr-4">
                  <BoutonsRole userId={p.id} roles={rolesDe(p.id)} estOwner={estOwner} />
                </td>
                <td className="py-3 whitespace-nowrap text-encre-doux">
                  {dateCourte(p.created_at)}
                </td>
              </tr>
            ))}
          </Tableau>
        </div>
      ) : (
        <Vide>Aucun compte.</Vide>
      )}
    </>
  );
}
