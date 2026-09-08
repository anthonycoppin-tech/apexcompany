'use client';

import { useActionState } from 'react';

import { mettreAJourCompte, type EtatCompte } from './actions';

const ETAT_INITIAL: EtatCompte = { erreur: null, ok: false };

export function FormulaireCompte({
  prenom,
  nom,
  telephone,
  email,
}: {
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  email: string;
}) {
  const [etat, action, enCours] = useActionState(mettreAJourCompte, ETAT_INITIAL);

  return (
    <form action={action} className="max-w-sm space-y-4">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Prénom</span>
        <input
          name="prenom"
          defaultValue={prenom ?? ''}
          required
          className="w-full rounded border p-2"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Nom</span>
        <input name="nom" defaultValue={nom ?? ''} className="w-full rounded border p-2" />
        {/* Le formulaire d'entrée ne le demande pas ; la facturation, si. */}
        <span className="block text-xs text-neutral-500">
          Nécessaire pour établir tes factures.
        </span>
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Téléphone</span>
        <input
          name="telephone"
          type="tel"
          defaultValue={telephone ?? ''}
          className="w-full rounded border p-2"
        />
      </label>

      <div className="space-y-1 text-sm">
        <span className="font-medium">Email</span>
        <p className="rounded border bg-neutral-50 p-2 text-neutral-600">{email}</p>
        <span className="block text-xs text-neutral-500">
          L’email porte l’identité de ton compte : écris-nous pour le changer.
        </span>
      </div>

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
