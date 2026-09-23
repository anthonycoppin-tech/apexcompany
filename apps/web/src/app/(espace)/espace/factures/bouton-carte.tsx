'use client';

import { useActionState } from 'react';

import { MessageLigne } from '@/components/message';
import { BoutonAction } from '@/components/ui';
import { REPOS, messageDe } from '@/lib/messages/types';

import { ouvrirMiseAJourCarte } from './actions';

/** Ouvre le portail de gestion de l'abonnement chez Whop, pour un abonnement en échec. */
export function BoutonCarte({ subscriptionId }: { subscriptionId: string }) {
  const [etat, action, enCours] = useActionState(ouvrirMiseAJourCarte, REPOS);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="subscription_id" value={subscriptionId} />
      <BoutonAction type="submit" disabled={enCours}>
        {enCours ? 'Ouverture…' : 'Mettre à jour ma carte'}
      </BoutonAction>
      <MessageLigne message={messageDe(etat)} />
    </form>
  );
}
