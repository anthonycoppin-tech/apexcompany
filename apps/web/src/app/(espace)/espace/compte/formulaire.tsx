'use client';

import { useActionState } from 'react';

import { BoutonAction, CHAMP } from '@/components/ui';
import { MessageLigne } from '@/components/message';
import { REPOS, messageDe } from '@/lib/messages/types';

import { mettreAJourCompte } from './actions';

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
  const [etat, action, enCours] = useActionState(mettreAJourCompte, REPOS);

  return (
    <form action={action} className="max-w-md space-y-5">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Prénom</span>
        <input name="prenom" defaultValue={prenom ?? ''} required className={CHAMP} />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Nom</span>
        <input name="nom" defaultValue={nom ?? ''} className={CHAMP} />
        {/* Le formulaire d'entrée ne le demande pas ; la facturation, si. */}
        <span className="block text-xs text-encre-faible">
          Nécessaire pour établir tes factures.
        </span>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Téléphone</span>
        <input name="telephone" type="tel" defaultValue={telephone ?? ''} className={CHAMP} />
      </label>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Email</span>
        <p className="rounded-douce border border-filet bg-surface px-3 py-2 text-sm text-encre-doux">
          {email}
        </p>
        <span className="block text-xs text-encre-faible">
          L’email porte l’identité de ton compte : écris-nous pour le changer.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <BoutonAction type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonAction>
        <MessageLigne message={messageDe(etat)} />
      </div>
    </form>
  );
}
