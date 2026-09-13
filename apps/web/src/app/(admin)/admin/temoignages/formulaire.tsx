'use client';

import { useActionState, useState } from 'react';

import { BoutonAction, CHAMP } from '@/components/ui';

import { enregistrerTemoignage, supprimerTemoignage, type EtatTemoignage } from './actions';

const ETAT_INITIAL: EtatTemoignage = { erreur: null, ok: false };

type Temoignage = {
  id: string;
  auteur: string;
  contexte: string | null;
  contenu: string;
  note: number | null;
  formation_id: string | null;
  consentement: boolean;
  publie: boolean;
  ordre: number;
};

/**
 * Saisie d'un témoignage.
 *
 * Les retours de succès et d'erreur reprennent **le motif déjà présent dans le
 * code** (`role="status"` et `role="alert"` en ligne, comme `/espace/compte`).
 * Rien de nouveau n'est inventé ici : un système de messages est en cours de
 * conception (`docs/09-CHANTIERS.md`), et lui opposer une convention de plus
 * serait exactement ce qu'il cherche à supprimer.
 */
export function FormulaireTemoignage({
  temoignage,
  formations,
}: {
  temoignage?: Temoignage;
  formations: Array<{ id: string; titre: string }>;
}) {
  const [etat, action, enCours] = useActionState(enregistrerTemoignage, ETAT_INITIAL);

  // Le consentement pilote l'affichage de « publier » : on ne propose pas une
  // case que l'enregistrement refusera. La contrainte en base reste la garantie.
  const [consentement, setConsentement] = useState(temoignage?.consentement ?? false);
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);

  return (
    <div className="space-y-8">
      <form action={action} className="max-w-2xl space-y-5">
        {temoignage && <input type="hidden" name="id" value={temoignage.id} />}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Auteur</span>
          <input name="auteur" defaultValue={temoignage?.auteur ?? ''} required className={CHAMP} />
          <span className="block text-xs text-encre-faible">
            Tel qu’il sera affiché. Un prénom et une initiale suffisent.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Contexte</span>
          <input
            name="contexte"
            defaultValue={temoignage?.contexte ?? ''}
            placeholder="Accompagnement 3 mois"
            className={CHAMP}
          />
          <span className="block text-xs text-encre-faible">
            Ce qui situe la personne. Un témoignage sans contexte ne se vérifie pas et convainc
            moins.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Témoignage</span>
          <textarea
            name="contenu"
            rows={5}
            defaultValue={temoignage?.contenu ?? ''}
            required
            className={CHAMP}
          />
        </label>

        <div className="flex flex-wrap gap-5">
          <label className="space-y-1.5">
            <span className="block text-sm font-medium">Note</span>
            <input
              name="note"
              type="number"
              min={1}
              max={5}
              defaultValue={temoignage?.note ?? ''}
              className={`${CHAMP} w-24 tabular-nums`}
            />
            <span className="block text-xs text-encre-faible">De 1 à 5, ou vide.</span>
          </label>

          <label className="space-y-1.5">
            <span className="block text-sm font-medium">Ordre</span>
            <input
              name="ordre"
              type="number"
              min={0}
              defaultValue={temoignage?.ordre ?? 0}
              className={`${CHAMP} w-24 tabular-nums`}
            />
          </label>

          <label className="flex-1 space-y-1.5">
            <span className="block text-sm font-medium">Programme concerné</span>
            <select
              name="formation_id"
              defaultValue={temoignage?.formation_id ?? ''}
              className={CHAMP}
            >
              <option value="">Aucun en particulier</option>
              {formations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.titre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-3 rounded-carte border border-filet bg-surface p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="consentement"
              defaultChecked={temoignage?.consentement ?? false}
              onChange={(e) => setConsentement(e.target.checked)}
              className="mt-1 accent-accent"
            />
            <span>
              <span className="font-medium">L’accord écrit de publication a été obtenu.</span>
              <span className="mt-1 block text-xs leading-relaxed text-encre-doux">
                Publier le nom et les mots d’une personne est un traitement de données personnelles.
                Sans cet accord, la publication est refusée — par cet écran et par la base.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 border-t border-filet pt-3 text-sm">
            <input
              type="checkbox"
              name="publie"
              defaultChecked={temoignage?.publie ?? false}
              disabled={!consentement}
              className="accent-accent disabled:opacity-40"
            />
            <span className={consentement ? '' : 'text-encre-faible'}>
              Publier sur le site
              {!consentement && ' — nécessite l’accord ci-dessus'}
            </span>
          </label>
        </div>

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

      {temoignage && (
        <div className="max-w-2xl border-t border-filet pt-6">
          {/* En deux temps, et à distance du bouton « Enregistrer ».
              La suppression est irréversible **et** efface la trace du
              consentement : le déclencheur d'audit de cette table ne couvre que
              les modifications, pas les suppressions. Un clic de trop ici, et
              plus rien ne dit qu'on avait eu l'accord de la personne. */}
          {!confirmeSuppression ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmeSuppression(true)}
                className="text-sm text-encre-doux underline hover:text-alerte"
              >
                Supprimer ce témoignage
              </button>
              <p className="mt-2 text-xs text-encre-faible">
                À utiliser si la personne retire son accord. Pour seulement le retirer du site,
                décoche « Publier ».
              </p>
            </>
          ) : (
            <form action={supprimerTemoignage} className="space-y-3">
              <input type="hidden" name="id" value={temoignage.id} />
              <p className="text-sm leading-relaxed text-alerte">
                Supprimer définitivement le témoignage de {temoignage.auteur} ? La trace du
                consentement disparaît avec lui, et rien ne permettra plus d’établir qu’il avait été
                obtenu.
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
