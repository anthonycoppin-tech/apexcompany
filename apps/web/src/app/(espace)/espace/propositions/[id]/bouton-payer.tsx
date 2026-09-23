'use client';

import { useActionState } from 'react';

import { CasesAcceptation } from '@/components/cases-acceptation';
import { BoutonAction } from '@/components/ui';
import { MessageLigne } from '@/components/message';
import { REPOS, messageDe } from '@/lib/messages/types';

import { ouvrirPaiement } from './actions';

export function BoutonPayer({
  propositionId,
  typeProduit,
}: {
  propositionId: string;
  typeProduit: string;
}) {
  const [etat, action, enCours] = useActionState(ouvrirPaiement, REPOS);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="proposition_id" value={propositionId} />
      <CasesAcceptation typeProduit={typeProduit} />
      <BoutonAction type="submit" disabled={enCours}>
        {enCours ? 'Ouverture du paiement…' : 'Payer et ouvrir mon accès'}
      </BoutonAction>
      <MessageLigne message={messageDe(etat)} />
      <p className="text-xs text-encre-faible">
        Paiement sécurisé par Whop. Votre accès s’ouvre dès l’encaissement.
      </p>
    </form>
  );
}
