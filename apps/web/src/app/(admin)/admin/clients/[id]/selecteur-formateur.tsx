'use client';

import { useActionState } from 'react';

import { MessageLigne } from '@/components/message';
import { BoutonAction, CHAMP } from '@/components/ui';
import { REPOS, messageDe } from '@/lib/messages/types';

import { affecterFormateur } from '../actions';

/**
 * Choisir le formateur d'un accès, sur la ligne même de l'accès.
 *
 * Un bouton plutôt qu'un enregistrement au changement de la liste : confier un
 * client ouvre ses coordonnées et son suivi à quelqu'un, ce n'est pas un geste
 * qu'on fait en faisant défiler une liste au clavier.
 */
export function SelecteurFormateur({
  inscriptionId,
  actuel,
  formateurs,
}: {
  inscriptionId: string;
  actuel: string | null;
  formateurs: Array<{ id: string; nom: string }>;
}) {
  const [etat, action, enCours] = useActionState(affecterFormateur, REPOS);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="inscription_id" value={inscriptionId} />
      <label className="sr-only" htmlFor={`formateur-${inscriptionId}`}>
        Formateur
      </label>
      <select
        id={`formateur-${inscriptionId}`}
        name="formateur_id"
        defaultValue={actuel ?? ''}
        className={`${CHAMP} w-auto py-1.5 text-sm`}
      >
        <option value="">Aucun formateur</option>
        {formateurs.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nom}
          </option>
        ))}
      </select>
      <BoutonAction type="submit" variante="secondaire" disabled={enCours} className="px-3 py-1.5">
        {enCours ? '…' : 'Affecter'}
      </BoutonAction>
      <MessageLigne message={messageDe(etat)} />
    </form>
  );
}
