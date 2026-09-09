'use client';

import { useActionState, useState } from 'react';

import { BoutonAction } from '@/components/ui';

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
      <p role="status" className="text-sm text-encre-doux">
        Résiliation enregistrée. Ton accès reste ouvert jusqu’au {finDePeriode}.
      </p>
    );
  }

  if (!confirme) {
    return (
      <button
        type="button"
        onClick={() => setConfirme(true)}
        className="text-sm text-encre-doux underline hover:text-encre"
      >
        Résilier mon abonnement
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3 border-t border-filet pt-4">
      <input type="hidden" name="subscription_id" value={subscriptionId} />
      <p className="text-sm leading-relaxed text-encre-doux">
        Ton accès reste ouvert jusqu’au {finDePeriode}, puis il se ferme. Aucun prélèvement ne sera
        fait ensuite.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {/* La confirmation reste en bouton secondaire : on n'encourage pas la
            résiliation, mais on ne la déguise pas non plus en lien discret. */}
        <BoutonAction type="submit" variante="secondaire" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Confirmer la résiliation'}
        </BoutonAction>
        <button
          type="button"
          onClick={() => setConfirme(false)}
          className="text-sm text-encre-doux underline hover:text-encre"
        >
          Annuler
        </button>
      </div>
      {etat.erreur && (
        <p role="alert" className="text-sm text-alerte">
          {etat.erreur}
        </p>
      )}
    </form>
  );
}
