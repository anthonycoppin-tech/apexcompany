'use client';

import { useActionState } from 'react';

import { ROLES, type AppRole } from '@apex/db';

import { changerRole, type EtatRole } from './actions';

const ETAT_INITIAL: EtatRole = { erreur: null, ok: false };

const LIBELLES: Record<AppRole, string> = {
  client: 'Client',
  formateur: 'Formateur',
  branding: 'Branding',
  admin: 'Admin',
  owner: 'Owner',
};

/**
 * Les rôles d'une personne, en boutons à bascule.
 *
 * Chaque rôle est un bouton : cliquer l'accorde, recliquer le retire. Une liste
 * déroulante suggérerait qu'un compte n'a qu'un rôle, ce qui est faux — un
 * owner est aussi souvent formateur, et le modèle le permet depuis le début.
 *
 * Les boutons sont désactivés pour un non-owner. Ce n'est **pas** la protection :
 * la politique `user_roles_owner_ecrit` refuserait l'écriture de toute façon.
 * C'est simplement plus honnête que de laisser cliquer sur ce qui va échouer.
 */
export function BoutonsRole({
  userId,
  roles,
  estOwner,
}: {
  userId: string;
  roles: string[];
  estOwner: boolean;
}) {
  const [etat, action, enCours] = useActionState(changerRole, ETAT_INITIAL);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {ROLES.map((role) => {
          const actif = roles.includes(role);

          return (
            <form key={role} action={action} className="contents">
              <input type="hidden" name="user_id" value={userId} />
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="sens" value={actif ? 'retirer' : 'accorder'} />
              <button
                type="submit"
                disabled={!estOwner || enCours}
                title={
                  estOwner
                    ? actif
                      ? `Retirer le rôle ${LIBELLES[role]}`
                      : `Accorder le rôle ${LIBELLES[role]}`
                    : 'Seul un owner modifie les rôles'
                }
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  actif
                    ? 'bg-accent text-accent-contraste hover:bg-accent-fort'
                    : 'bg-surface-forte text-encre-doux hover:bg-filet'
                }`}
              >
                {LIBELLES[role]}
              </button>
            </form>
          );
        })}
      </div>

      {etat.erreur && <p className="text-xs text-alerte">{etat.erreur}</p>}
    </div>
  );
}
