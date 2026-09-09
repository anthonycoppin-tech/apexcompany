'use client';

import { useActionState } from 'react';

import { BoutonAction, CHAMP } from '@/components/ui';

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
    <form action={action} className="space-y-4 border-t border-filet pt-4">
      <input type="hidden" name="id" value={id} />

      <div className="flex flex-wrap items-center gap-2">
        {ISSUES.map((o) => (
          <label
            key={o.valeur}
            className="flex cursor-pointer items-center gap-2 rounded-douce border border-filet px-3 py-2 text-sm transition-colors hover:bg-surface has-checked:border-accent has-checked:bg-accent-doux"
          >
            <input
              type="radio"
              name="issue"
              value={o.valeur}
              defaultChecked={issue === o.valeur}
              className="accent-accent"
            />
            {o.libelle}
          </label>
        ))}
      </div>

      <textarea
        name="compte_rendu"
        rows={3}
        defaultValue={compteRendu ?? ''}
        placeholder="Ce qui s’est dit, ce qui a été proposé, ce qui reste à faire."
        className={CHAMP}
      />

      <div className="flex flex-wrap items-center gap-4">
        <BoutonAction type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonAction>
        {etat.ok && (
          <span role="status" className="text-sm font-medium text-succes">
            Enregistré.
          </span>
        )}
        {etat.erreur && (
          <span role="alert" className="text-sm text-alerte">
            {etat.erreur}
          </span>
        )}
      </div>
    </form>
  );
}
