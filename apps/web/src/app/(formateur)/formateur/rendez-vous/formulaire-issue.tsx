'use client';

import { useActionState } from 'react';

import { consignerIssue, type EtatCompteRendu } from './actions';

const ETAT_INITIAL: EtatCompteRendu = { erreur: null, ok: false };

const ISSUES = [
  { valeur: 'honore', libelle: 'Honoré' },
  { valeur: 'absent', libelle: 'Absent' },
  { valeur: 'annule', libelle: 'Annulé' },
] as const;

/**
 * Le formulaire de compte rendu, un par rendez-vous passé.
 *
 * Les trois issues sont des boutons radio et non une liste déroulante : à trois
 * choix, la liste ajoute un clic sans rien apporter, et « absent » doit être
 * aussi facile à cocher que « honoré » — sinon la statistique de no-show se
 * remplit mal, et c'est justement celle qu'on veut.
 */
export function FormulaireIssue({
  id,
  issue,
  compteRendu,
}: {
  id: string;
  issue: string | null;
  compteRendu: string | null;
}) {
  const [etat, action, enCours] = useActionState(consignerIssue, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-3 border-t pt-3">
      <input type="hidden" name="id" value={id} />

      <div className="flex flex-wrap items-center gap-4">
        {ISSUES.map((o) => (
          <label key={o.valeur} className="flex items-center gap-2 text-sm">
            <input type="radio" name="issue" value={o.valeur} defaultChecked={issue === o.valeur} />
            {o.libelle}
          </label>
        ))}
      </div>

      <textarea
        name="compte_rendu"
        rows={3}
        defaultValue={compteRendu ?? ''}
        placeholder="Ce qui s’est dit, ce qui a été proposé, ce qui reste à faire."
        className="w-full rounded border p-2 text-sm"
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {etat.ok && <span className="text-sm text-green-700">Enregistré.</span>}
        {etat.erreur && <span className="text-sm text-red-600">{etat.erreur}</span>}
      </div>
    </form>
  );
}
