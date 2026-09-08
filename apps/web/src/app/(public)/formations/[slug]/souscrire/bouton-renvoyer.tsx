'use client';

import { useActionState } from 'react';

import { renvoyerVerification, type EtatSouscription } from './actions';

const ETAT_INITIAL: EtatSouscription = { erreur: null };

/**
 * Sans ce bouton, le contrôle bloquant sur l'email vérifié serait une impasse :
 * la personne verrait « vérifie ton adresse » sans moyen d'en redemander une.
 */
export function BoutonRenvoyer() {
  const [etat, action, enCours] = useActionState(renvoyerVerification, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-2">
      <button
        type="submit"
        disabled={enCours}
        className="rounded-douce border border-filet-fort px-4 py-2 text-sm font-medium transition-colors hover:bg-surface disabled:opacity-50"
      >
        {enCours ? 'Envoi…' : 'Renvoyer l’email de vérification'}
      </button>
      {etat.erreur && <p className="text-sm text-alerte">{etat.erreur}</p>}
    </form>
  );
}
