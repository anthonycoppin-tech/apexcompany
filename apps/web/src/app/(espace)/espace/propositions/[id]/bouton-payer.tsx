'use client';

import { useActionState } from 'react';

import { BoutonAction } from '@/components/ui';

import { ouvrirPaiement, type EtatPaiement } from './actions';

const ETAT_INITIAL: EtatPaiement = { erreur: null };

export function BoutonPayer({ propositionId }: { propositionId: string }) {
  const [etat, action, enCours] = useActionState(ouvrirPaiement, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="proposition_id" value={propositionId} />
      <BoutonAction type="submit" disabled={enCours}>
        {enCours ? 'Ouverture du paiement…' : 'Payer et ouvrir mon accès'}
      </BoutonAction>
      {etat.erreur && (
        <p role="alert" className="text-sm text-alerte">
          {etat.erreur}
        </p>
      )}
      <p className="text-xs text-encre-faible">
        Paiement sécurisé par Stripe. Ton accès s’ouvre dès l’encaissement.
      </p>
    </form>
  );
}
