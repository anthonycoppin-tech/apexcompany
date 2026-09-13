'use client';

import { useActionState, useState } from 'react';

import { BoutonAction, CHAMP } from '@/components/ui';

import { enregistrerFiche, supprimerFiche, type EtatFiche } from './actions';

const ETAT_INITIAL: EtatFiche = { erreur: null, ok: false };

type Fiche = {
  id: string;
  nom: string;
  fonction: string | null;
  biographie: string | null;
  specialites: string[];
  photo_url: string | null;
  user_id: string | null;
  publie: boolean;
  ordre: number;
};

/**
 * Saisie d'une fiche publique.
 *
 * Mêmes retours que le reste du back-office (`role="status"`, `role="alert"`),
 * sans convention nouvelle : le système de messages est un chantier en cours.
 */
export function FormulaireFiche({
  fiche,
  comptes,
}: {
  fiche?: Fiche;
  comptes: Array<{ id: string; libelle: string }>;
}) {
  const [etat, action, enCours] = useActionState(enregistrerFiche, ETAT_INITIAL);
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);

  return (
    <div className="space-y-8">
      <form action={action} className="max-w-2xl space-y-5">
        {fiche && <input type="hidden" name="id" value={fiche.id} />}

        <div className="flex flex-wrap gap-5">
          <label className="flex-1 space-y-1.5">
            <span className="block text-sm font-medium">Nom affiché</span>
            <input name="nom" defaultValue={fiche?.nom ?? ''} required className={CHAMP} />
          </label>

          <label className="space-y-1.5">
            <span className="block text-sm font-medium">Ordre</span>
            <input
              name="ordre"
              type="number"
              min={0}
              defaultValue={fiche?.ordre ?? 0}
              className={`${CHAMP} w-24 tabular-nums`}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Fonction</span>
          <input
            name="fonction"
            defaultValue={fiche?.fonction ?? ''}
            placeholder="Directeur de l’accompagnement"
            className={CHAMP}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Biographie</span>
          <textarea
            name="biographie"
            rows={6}
            defaultValue={fiche?.biographie ?? ''}
            className={CHAMP}
          />
          <span className="block text-xs text-encre-faible">
            Ce qui répond à « à qui vais-je avoir affaire ? ». Parcours, expérience, façon de
            travailler.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Spécialités</span>
          <input
            name="specialites"
            defaultValue={(fiche?.specialites ?? []).join(', ')}
            placeholder="psychologie de l’exécution, gestion du risque"
            className={CHAMP}
          />
          <span className="block text-xs text-encre-faible">Séparées par des virgules.</span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Photo</span>
          <input
            name="photo_url"
            type="url"
            defaultValue={fiche?.photo_url ?? ''}
            placeholder="https://…"
            className={CHAMP}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Compte rattaché</span>
          <select name="user_id" defaultValue={fiche?.user_id ?? ''} className={CHAMP}>
            <option value="">Aucun</option>
            {comptes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
              </option>
            ))}
          </select>
          {/* Facultatif dans les deux sens : une fiche peut présenter quelqu'un
              sans compte, et un compte n'a pas vocation à être publié. */}
          <span className="block text-xs text-encre-faible">
            Facultatif, et sans effet sur les accès — c’est `user_roles` qui décide de ce qu’une
            personne peut faire.
          </span>
        </label>

        <label className="flex cursor-pointer items-center gap-3 rounded-carte border border-filet bg-surface p-4 text-sm">
          <input
            type="checkbox"
            name="publie"
            defaultChecked={fiche?.publie ?? false}
            className="accent-accent"
          />
          <span>Afficher sur la page « L’équipe »</span>
        </label>

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

      {fiche && (
        <div className="max-w-2xl border-t border-filet pt-6">
          {/* En deux temps, et à distance d'« Enregistrer » : une biographie
              écrite à la main ne se retrouve pas si on l'efface par erreur. */}
          {!confirmeSuppression ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmeSuppression(true)}
                className="text-sm text-encre-doux underline hover:text-alerte"
              >
                Supprimer cette fiche
              </button>
              <p className="mt-2 text-xs text-encre-faible">
                Supprime la fiche publique, pas le compte. Pour seulement la retirer du site,
                décoche l’affichage.
              </p>
            </>
          ) : (
            <form action={supprimerFiche} className="space-y-3">
              <input type="hidden" name="id" value={fiche.id} />
              <p className="text-sm leading-relaxed text-alerte">
                Supprimer définitivement la fiche de {fiche.nom} ? La biographie et les spécialités
                seront perdues. Le compte, lui, n’est pas touché.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <BoutonAction type="submit" variante="secondaire">
                  Oui, supprimer
                </BoutonAction>
                <button
                  type="button"
                  onClick={() => setConfirmeSuppression(false)}
                  className="text-sm text-encre-doux underline hover:text-encre"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
