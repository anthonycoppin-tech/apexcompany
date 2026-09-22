'use client';

import { useActionState, useState } from 'react';

import { MessageLigne } from '@/components/message';
import { REPOS, messageDe } from '@/lib/messages/types';

import { demanderRemboursement } from '../../paiements/remboursements/actions';

/**
 * Demander un remboursement depuis la fiche client.
 *
 * La demande se fait ici parce que c'est ici qu'on a le contexte — qui, quel
 * produit, quel encaissement. L'exécution, elle, se fait depuis
 * `/admin/paiements/remboursements`.
 *
 * **Deux temps, et c'est volontaire pour de l'argent qui sort.** Les colonnes
 * `demande_par` et `traite_par` existent précisément pour porter cette trace :
 * savoir qui a demandé et qui a validé vaut mieux que de découvrir un
 * remboursement sans savoir d'où il vient.
 *
 * Pour un accompagnement encore dans son délai de rétractation, la page
 * calcule le montant dû au client (`lib/paiement/retractation.ts`) et le
 * propose tout prêt. Une fois exécuté, le remboursement referme l'accès comme
 * n'importe quel autre.
 */
export function FormulaireRemboursement({
  paymentId,
  montantMax,
  retractation,
}: {
  paymentId: string;
  montantMax: string;
  retractation: { montantEuros: string; explication: string } | null;
}) {
  const [etat, action, enCours] = useActionState(demanderRemboursement, REPOS);
  const [ouvert, setOuvert] = useState<false | 'libre' | 'retractation'>(false);
  const prerempli = ouvert === 'retractation' && retractation;

  if (etat.statut === 'succes') {
    return (
      <span className="text-xs text-succes">
        Demande enregistrée — à exécuter depuis les remboursements.
      </span>
    );
  }

  if (!ouvert) {
    return (
      <span className="mt-1 block space-y-1">
        {retractation && (
          <span className="block max-w-xs text-xs leading-relaxed text-encre-doux">
            {retractation.explication}{' '}
            <button
              type="button"
              onClick={() => setOuvert('retractation')}
              className="font-medium text-accent underline"
            >
              Préparer la rétractation
            </button>
          </span>
        )}
        <button
          type="button"
          onClick={() => setOuvert('libre')}
          className="text-xs text-encre-doux underline"
        >
          Demander un remboursement
        </button>
      </span>
    );
  }

  return (
    <form action={action} className="mt-2 space-y-2 rounded-douce border border-filet p-3">
      <input type="hidden" name="payment_id" value={paymentId} />

      <label className="block space-y-1 text-xs">
        <span className="font-medium">Montant (€)</span>
        <input
          name="montant_euros"
          type="text"
          inputMode="decimal"
          placeholder={montantMax}
          defaultValue={prerempli ? prerempli.montantEuros : undefined}
          className="w-28 rounded-douce border border-filet-fort p-1.5 text-sm tabular-nums"
        />
        <span className="block text-encre-doux">
          Vide = la totalité. Un remboursement partiel est possible.
        </span>
      </label>

      <label className="block space-y-1 text-xs">
        <span className="font-medium">Motif</span>
        <input
          name="motif"
          required
          defaultValue={prerempli ? 'Rétractation — article 8 des CGV' : undefined}
          className="w-full rounded-douce border border-filet-fort p-1.5 text-sm"
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-douce bg-encre px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {enCours ? 'Envoi…' : 'Enregistrer la demande'}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-xs text-encre-doux underline"
        >
          Annuler
        </button>
      </div>

      <MessageLigne message={messageDe(etat)} taille="petite" />
    </form>
  );
}
