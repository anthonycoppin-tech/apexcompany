'use client';

import { useActionState } from 'react';

import { MessageLigne } from '@/components/message';
import { CHAMP } from '@/components/ui';
import { REPOS, messageDe } from '@/lib/messages/types';

import { rattacherPaiement } from './actions';

export type Produit = { id: string; titre: string; actif: boolean };

/**
 * Rattacher un paiement à un compte et à un produit.
 *
 * Deux champs seulement, et ils portent les deux choses que le webhook n'a pas
 * pu savoir : **qui** a payé et **quoi**. L'adresse est pré-remplie avec celle
 * de l'acheteur chez Whop quand elle est connue — mais elle reste modifiable,
 * parce qu'elle n'est pas forcément celle du compte : on achète souvent avec
 * l'adresse de son moyen de paiement.
 *
 * Le produit reconnu par son plan est présélectionné, jamais imposé.
 */
export function FormulaireRattachement({
  logId,
  emailPropose,
  produitPropose,
  produits,
}: {
  logId: string;
  emailPropose: string | null;
  produitPropose: string | null;
  produits: Produit[];
}) {
  const [etat, action, enCours] = useActionState(rattacherPaiement, REPOS);

  if (etat.statut === 'succes') {
    return <MessageLigne message={messageDe(etat)} taille="petite" />;
  }

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-filet pt-4">
      <input type="hidden" name="log_id" value={logId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Compte du client</span>
          <input
            type="email"
            name="email"
            required
            defaultValue={emailPropose ?? ''}
            placeholder="adresse du compte sur le site"
            className={CHAMP}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Produit acheté</span>
          <select
            name="formation_id"
            required
            defaultValue={produitPropose ?? ''}
            className={CHAMP}
          >
            <option value="">Choisir…</option>
            {produits.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titre}
                {p.actif ? '' : ' (brouillon)'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-douce bg-accent px-4 py-2 text-sm font-semibold text-accent-contraste hover:bg-accent-fort disabled:opacity-50"
        >
          {enCours ? 'Rattachement…' : 'Rattacher et ouvrir l’accès'}
        </button>
        <MessageLigne message={messageDe(etat)} taille="petite" />
      </div>
    </form>
  );
}
