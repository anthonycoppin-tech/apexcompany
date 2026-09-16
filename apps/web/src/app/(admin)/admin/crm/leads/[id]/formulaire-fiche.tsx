'use client';

import { useActionState } from 'react';

import { PIPELINE } from '@/lib/crm/pipeline';
import { MessageLigne } from '@/components/message';
import { REPOS, messageDe } from '@/lib/messages/types';

import { mettreAJourFiche } from './actions';

/**
 * Affectation et statut, dans un seul formulaire.
 *
 * Les deux se décident au même moment — on affecte un prospect en même temps
 * qu'on le fait avancer — et deux boutons « enregistrer » côte à côte
 * produisent surtout des demi-enregistrements.
 */
export function FormulaireFiche({
  leadId,
  affecteA,
  statut,
  formateurs,
}: {
  leadId: string;
  affecteA: string | null;
  statut: string;
  formateurs: Array<{ id: string; nom: string }>;
}) {
  const [etat, action, enCours] = useActionState(mettreAJourFiche, REPOS);

  return (
    <form action={action} className="flex flex-wrap items-end gap-4">
      <input type="hidden" name="lead_id" value={leadId} />

      <label className="space-y-1 text-sm">
        <span className="block font-medium">Affecté à</span>
        <select
          name="assigned_to"
          defaultValue={affecteA ?? ''}
          className="rounded-douce border border-filet-fort bg-fond p-2 text-sm"
        >
          <option value="">— personne —</option>
          {formateurs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nom}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-sm">
        <span className="block font-medium">Statut</span>
        <select
          name="statut"
          defaultValue={statut}
          className="rounded-douce border border-filet-fort bg-fond p-2 text-sm"
        >
          {PIPELINE.map((e) => (
            <option key={e.valeur} value={e.valeur}>
              {e.libelle}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={enCours}
        className="rounded-douce bg-accent px-4 py-2 text-sm font-semibold text-accent-contraste hover:bg-accent-fort disabled:opacity-50"
      >
        {enCours ? 'Enregistrement…' : 'Enregistrer'}
      </button>

      <MessageLigne message={messageDe(etat)} />
    </form>
  );
}
