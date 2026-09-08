'use client';

import { useActionState } from 'react';

import { ouvrirPaiement, type EtatPaiement } from './actions';

const ETAT_INITIAL: EtatPaiement = { erreur: null };

export function BoutonPayer({ propositionId }: { propositionId: string }) {
  const [etat, action, enCours] = useActionState(ouvrirPaiement, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="proposition_id" value={propositionId} />
      <button
        type="submit"
        disabled={enCours}
        className="rounded bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {enCours ? 'Ouverture du paiement…' : 'Payer et ouvrir mon accès'}
      </button>
      {etat.erreur && <p className="text-sm text-red-600">{etat.erreur}</p>}
      <p className="text-xs text-neutral-500">
        Paiement sécurisé par Stripe. Ton accès s’ouvre dès l’encaissement.
      </p>
    </form>
  );
}
