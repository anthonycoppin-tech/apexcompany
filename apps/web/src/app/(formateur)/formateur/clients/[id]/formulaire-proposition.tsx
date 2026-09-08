'use client';

import { useActionState } from 'react';

import { formaterMontant } from '@apex/db';

import { emettreProposition, type EtatProposition } from './actions';

const ETAT_INITIAL: EtatProposition = { erreur: null, ok: false };

type Formation = {
  id: string;
  titre: string;
  prix_cents: number;
  devise: string;
  type_produit: string;
  modalite: string;
};

const TYPES: Record<string, string> = {
  abonnement: 'Abonnement mensuel',
  accompagnement: 'Accompagnement',
  formation: 'Formation',
};

/**
 * Émission d'une proposition, depuis la fiche client.
 *
 * Le prix s'affiche à côté de chaque produit mais ne se saisit pas : il vient du
 * catalogue. C'est un prix public, celui de la fiche produit — le montant que le
 * client a réellement payé, lui, reste fermé au formateur.
 */
export function FormulaireProposition({
  leadId,
  formations,
  sansCompte,
}: {
  leadId: string;
  formations: Formation[];
  sansCompte: boolean;
}) {
  const [etat, action, enCours] = useActionState(emettreProposition, ETAT_INITIAL);

  if (sansCompte) {
    return (
      <p className="rounded border border-dashed p-3 text-sm text-neutral-600">
        Cette personne n’a pas de compte : une proposition ne pourrait pas lui être présentée. Elle
        en obtient un en passant par le formulaire de qualification.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded border p-4">
      <input type="hidden" name="lead_id" value={leadId} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Produit proposé</legend>
        {formations.map((f) => (
          <label key={f.id} className="flex items-baseline gap-2 text-sm">
            <input type="radio" name="formation_id" value={f.id} required />
            <span className="flex-1">
              {f.titre}
              <span className="text-neutral-500">
                {' '}
                · {TYPES[f.type_produit] ?? f.type_produit} ·{' '}
                {f.modalite === 'individuel' ? 'individuel' : 'groupe'}
              </span>
            </span>
            <span className="tabular-nums text-neutral-600">
              {formaterMontant(f.prix_cents, f.devise)}
            </span>
          </label>
        ))}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        Valable
        <input
          type="number"
          name="validite_jours"
          defaultValue={7}
          min={1}
          max={90}
          className="w-16 rounded border p-1 text-sm tabular-nums"
        />
        jours
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {enCours ? 'Envoi…' : 'Émettre la proposition'}
        </button>
        {etat.ok && (
          <span className="text-sm text-green-700">
            Proposition envoyée. Elle apparaît dans son espace.
          </span>
        )}
        {etat.erreur && <span className="text-sm text-red-600">{etat.erreur}</span>}
      </div>

      <p className="text-xs text-neutral-500">
        La nouvelle proposition périme celle qui était en cours : une seule est valable à la fois.
      </p>
    </form>
  );
}
