'use client';

import { useActionState, useState } from 'react';

import { resilierAbonnement, type EtatResiliation } from './actions';

const ETAT_INITIAL: EtatResiliation = { erreur: null, ok: false };

/**
 * Résiliation en deux temps.
 *
 * La confirmation n'est pas là pour retenir le client — aucun écran de
 * rétention, aucune offre de dernière minute. Elle sert à dire ce qui va se
 * passer : l'accès reste ouvert jusqu'au terme déjà payé. Sans cette phrase, la
 * question « est-ce que je perds mon accès tout de suite ? » arrive au support.
 */
export function BoutonResilier({
  subscriptionId,
  finDePeriode,
}: {
  subscriptionId: string;
  finDePeriode: string;
}) {
  const [etat, action, enCours] = useActionState(resilierAbonnement, ETAT_INITIAL);
  const [confirme, setConfirme] = useState(false);

  if (etat.ok) {
    return (
      <p className="text-sm text-neutral-600">
        Résiliation enregistrée. Ton accès reste ouvert jusqu’au {finDePeriode}.
      </p>
    );
  }

  if (!confirme) {
    return (
      <button
        type="button"
        onClick={() => setConfirme(true)}
        className="text-sm text-neutral-600 underline"
      >
        Résilier mon abonnement
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="subscription_id" value={subscriptionId} />
      <p className="text-sm text-neutral-600">
        Ton accès reste ouvert jusqu’au {finDePeriode}, puis il se ferme. Aucun prélèvement ne sera
        fait ensuite.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {enCours ? 'Enregistrement…' : 'Confirmer la résiliation'}
        </button>
        <button type="button" onClick={() => setConfirme(false)} className="text-sm underline">
          Annuler
        </button>
      </div>
      {etat.erreur && <p className="text-sm text-red-600">{etat.erreur}</p>}
    </form>
  );
}
