'use client';

import { useActionState } from 'react';

import { MessageLigne } from '@/components/message';
import { REPOS, messageDe } from '@/lib/messages/types';

import { renvoyerVerification } from './actions';

/**
 * Sans ce bouton, le contrôle bloquant sur l'email vérifié serait une impasse :
 * la personne verrait « vérifiez votre adresse » sans moyen d'en redemander une.
 */
export function BoutonRenvoyer() {
  const [etat, action, enCours] = useActionState(renvoyerVerification, REPOS);

  return (
    <form action={action} className="space-y-2">
      <button
        type="submit"
        disabled={enCours}
        className="rounded-douce border border-filet-fort px-4 py-2 text-sm font-medium transition-colors hover:bg-surface disabled:opacity-50"
      >
        {enCours ? 'Envoi…' : 'Renvoyer l’email de vérification'}
      </button>
      <MessageLigne message={messageDe(etat)} />
    </form>
  );
}
