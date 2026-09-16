'use client';

import { useActionState } from 'react';

import { BoutonAction } from '@/components/ui';
import { MessageLigne } from '@/components/message';
import { REPOS, messageDe } from '@/lib/messages/types';

import { reattribuerAccesDiscord } from './actions';

/**
 * « Réattribuer les accès Discord » — le geste de rattrapage, posé là où le
 * problème se constate plutôt que décrit dans une documentation qu'il faudrait
 * penser à ouvrir.

 */
export function BoutonReattribuer({ userId }: { userId: string }) {
  const [etat, action, enCours] = useActionState(reattribuerAccesDiscord, REPOS);

  return (
    <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
      <input type="hidden" name="user_id" value={userId} />
      <BoutonAction type="submit" variante="secondaire" disabled={enCours} className="px-4 py-2">
        {enCours ? 'Remise en file…' : 'Réattribuer les accès Discord'}
      </BoutonAction>

      <MessageLigne message={messageDe(etat)} />
    </form>
  );
}
