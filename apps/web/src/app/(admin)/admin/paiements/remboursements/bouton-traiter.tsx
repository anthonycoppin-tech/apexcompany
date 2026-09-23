'use client';

import { useActionState, useState } from 'react';

import { MessageLigne } from '@/components/message';
import { REPOS, messageDe } from '@/lib/messages/types';

import { traiterRemboursement } from './actions';

/**
 * Exécuter un remboursement, en deux clics.
 *
 * La confirmation n'est pas de la décoration : c'est de l'argent qui sort, et
 * l'opération ne se défait pas. Le montant est rappelé dans la question — un
 * « êtes-vous sûr ? » sans chiffre ne fait réfléchir personne.
 */
export function BoutonTraiter({ refundId, montant }: { refundId: string; montant: string }) {
  const [etat, action, enCours] = useActionState(traiterRemboursement, REPOS);
  const [confirme, setConfirme] = useState(false);

  if (etat.statut === 'succes') {
    return <span className="text-sm text-succes">Remboursé.</span>;
  }

  if (!confirme) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setConfirme(true)}
          className="rounded-douce border border-filet-fort px-3 py-1.5 text-sm font-medium hover:bg-surface"
        >
          Rembourser
        </button>
        <MessageLigne message={messageDe(etat)} taille="petite" />
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="refund_id" value={refundId} />
      <p className="text-xs text-encre-doux">
        Rembourser {montant} chez le prestataire ? L’accès correspondant sera fermé.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-douce bg-alerte px-3 py-1.5 text-sm font-semibold text-fond disabled:opacity-50"
        >
          {enCours ? 'Envoi…' : 'Confirmer'}
        </button>
        <button
          type="button"
          onClick={() => setConfirme(false)}
          className="text-sm text-encre-doux underline"
        >
          Annuler
        </button>
      </div>
      <MessageLigne message={messageDe(etat)} taille="petite" />
    </form>
  );
}
