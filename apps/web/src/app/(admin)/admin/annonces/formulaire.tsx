'use client';

import { useActionState, useState } from 'react';

import { BoutonAction, CHAMP } from '@/components/ui';
import { MessageLigne } from '@/components/message';
import { REPOS, messageDe } from '@/lib/messages/types';

import { enregistrerAnnonce, supprimerAnnonce } from './actions';

export type AnnonceEditable = {
  id: string;
  surtitre: string | null;
  titre: string;
  texte: string | null;
  date_evenement: string | null;
  lien_url: string | null;
  lien_libelle: string | null;
  publiee: boolean;
  /** Le dernier jour d'affichage, en `AAAA-MM-JJ` (heure de Paris). */
  dernier_jour: string;
};

/**
 * Saisie d'une annonce d'événement du premier bloc de l'accueil.
 *
 * Le rendu est montré à côté : c'est le client qui écrira ces textes, et un
 * titre trop long sur le dégradé se voit mieux qu'il ne se décrit.
 */
export function FormulaireAnnonce({ annonce }: { annonce?: AnnonceEditable }) {
  const [etat, action, enCours] = useActionState(enregistrerAnnonce, REPOS);
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);

  return (
    <div className="space-y-8">
      <form action={action} className="max-w-2xl space-y-5">
        {annonce && <input type="hidden" name="id" value={annonce.id} />}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Surtitre</span>
          <input
            name="surtitre"
            defaultValue={annonce?.surtitre ?? ''}
            placeholder="Événement"
            className={CHAMP}
          />
          <span className="block text-xs text-encre-faible">
            Le petit mot au-dessus du titre. « Événement » si vide.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Titre</span>
          <input name="titre" defaultValue={annonce?.titre ?? ''} required className={CHAMP} />
          <span className="block text-xs text-encre-faible">
            Court : il s’affiche en grandes capitales.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Texte</span>
          <textarea name="texte" rows={3} defaultValue={annonce?.texte ?? ''} className={CHAMP} />
          <span className="block text-xs text-encre-faible">
            Une ou deux phrases. Aucune promesse de gain : l’avertissement sur les risques vaut
            aussi ici.
          </span>
        </label>

        <div className="flex flex-wrap gap-5">
          <label className="space-y-1.5">
            <span className="block text-sm font-medium">Date de l’événement</span>
            <input
              name="date_evenement"
              type="date"
              defaultValue={annonce?.date_evenement ?? ''}
              className={CHAMP}
            />
            <span className="block text-xs text-encre-faible">
              Affiche la date et un compte à rebours.
            </span>
          </label>

          <label className="space-y-1.5">
            <span className="block text-sm font-medium">Afficher jusqu’au</span>
            <input
              name="fin_affichage"
              type="date"
              defaultValue={annonce?.dernier_jour ?? ''}
              className={CHAMP}
            />
            <span className="block text-xs text-encre-faible">
              Inclus. Vide : le jour de l’événement.
            </span>
          </label>
        </div>

        <div className="flex flex-wrap gap-5">
          <label className="flex-1 space-y-1.5">
            <span className="block text-sm font-medium">Texte du bouton</span>
            <input
              name="lien_libelle"
              defaultValue={annonce?.lien_libelle ?? ''}
              placeholder="Je veux participer"
              className={CHAMP}
            />
          </label>
          <label className="flex-1 space-y-1.5">
            <span className="block text-sm font-medium">Lien du bouton</span>
            <input
              name="lien_url"
              defaultValue={annonce?.lien_url ?? ''}
              placeholder="/inscription"
              className={CHAMP}
            />
          </label>
        </div>
        <p className="-mt-3 text-xs text-encre-faible">
          Facultatifs, mais ensemble. Une page du site (« /inscription », « /formations ») ou une
          adresse commençant par https:// — une billetterie, par exemple.
        </p>

        <label className="flex cursor-pointer items-center gap-3 rounded-carte border border-filet bg-surface p-4 text-sm">
          <input
            type="checkbox"
            name="publiee"
            defaultChecked={annonce?.publiee ?? false}
            className="accent-accent"
          />
          <span>
            <span className="font-medium">Publier sur l’accueil</span>
            <span className="mt-1 block text-xs text-encre-doux">
              Si plusieurs annonces sont publiées, l’accueil montre celle dont l’événement est le
              plus proche.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <BoutonAction type="submit" disabled={enCours}>
            {enCours ? 'Enregistrement…' : 'Enregistrer'}
          </BoutonAction>
          <MessageLigne message={messageDe(etat)} />
        </div>
      </form>

      {annonce && (
        <div className="max-w-2xl border-t border-filet pt-6">
          {!confirmeSuppression ? (
            <button
              type="button"
              onClick={() => setConfirmeSuppression(true)}
              className="text-sm text-encre-doux underline hover:text-alerte"
            >
              Supprimer cette annonce
            </button>
          ) : (
            <form action={supprimerAnnonce} className="space-y-3">
              <input type="hidden" name="id" value={annonce.id} />
              <p className="text-sm text-alerte">
                Supprimer définitivement « {annonce.titre} » ? Pour seulement la retirer de
                l’accueil, décochez « Publier ».
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
