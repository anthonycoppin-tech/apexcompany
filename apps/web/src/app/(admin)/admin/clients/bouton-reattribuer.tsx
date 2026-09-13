'use client';

import { useActionState } from 'react';

import { BoutonAction } from '@/components/ui';

import { reattribuerAccesDiscord, type EtatReattribution } from './actions';

const DEPART: EtatReattribution = { message: null, erreur: null };

/**
 * « Réattribuer les accès Discord » — le geste de rattrapage, posé là où le
 * problème se constate plutôt que décrit dans une documentation qu'il faudrait
 * penser à ouvrir.
 *
 * Les retours reprennent le motif en place (`role="status"`, `role="alert"`) :
 * un système de messages est en cours de conception, et lui opposer une
 * convention de plus serait exactement ce qu'il cherche à supprimer.
 */
export function BoutonReattribuer({ userId }: { userId: string }) {
  const [etat, action, enCours] = useActionState(reattribuerAccesDiscord, DEPART);

  return (
    <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
      <input type="hidden" name="user_id" value={userId} />
      <BoutonAction type="submit" variante="secondaire" disabled={enCours} className="px-4 py-2">
        {enCours ? 'Remise en file…' : 'Réattribuer les accès Discord'}
      </BoutonAction>

      {etat.message && (
        <span role="status" className="text-sm font-medium text-succes">
          {etat.message}
        </span>
      )}
      {etat.erreur && (
        <span role="alert" className="text-sm text-alerte">
          {etat.erreur}
        </span>
      )}
    </form>
  );
}
