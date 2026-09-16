'use client';

import { useActionState, useState } from 'react';

import { BoutonAction, CHAMP } from '@/components/ui';
import { CANAUX, MOTIFS_PERTE } from '@/lib/formateur/suivi';

import { consignerEchange, type EtatSuivi } from './suivi-actions';

const ETAT_INITIAL: EtatSuivi = { erreur: null, ok: false };

/**
 * « J'ai appelé, voilà ce qui s'est dit » — en un geste, depuis la fiche.
 *
 * Le type d'échange est en boutons radio, comme l'issue d'un rendez-vous : à
 * trois choix, une liste déroulante ajoute un clic sans rien apporter. Le motif
 * de perte n'apparaît que quand on marque la personne perdue — c'est la seule
 * donnée qu'on ne peut pas reconstituer après coup, et la seule qui explique un
 * taux de conversion.
 */
export function FormulaireSuivi({ leadId, estClient }: { leadId: string; estClient: boolean }) {
  const [statut, setStatut] = useState('');

  // React vide le formulaire après une action réussie ; le choix de statut,
  // lui, est un état : on le remet à zéro au même moment, sinon le motif de
  // perte resterait affiché sous un statut revenu à « Inchangé ».
  const [etat, action, enCours] = useActionState(
    async (precedent: EtatSuivi, donnees: FormData) => {
      const resultat = await consignerEchange(precedent, donnees);
      if (resultat.ok) setStatut('');
      return resultat;
    },
    ETAT_INITIAL,
  );

  return (
    <form action={action} className="space-y-4 rounded-carte border border-filet bg-fond p-5">
      <input type="hidden" name="lead_id" value={leadId} />

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Type d’échange</legend>
        {Object.entries(CANAUX).map(([valeur, libelle], i) => (
          <label
            key={valeur}
            className="flex cursor-pointer items-center gap-2 rounded-douce border border-filet px-3 py-2 text-sm transition-colors hover:bg-surface has-checked:border-accent has-checked:bg-accent-doux"
          >
            <input
              type="radio"
              name="canal"
              value={valeur}
              defaultChecked={i === 0}
              className="accent-accent"
            />
            {libelle}
          </label>
        ))}
      </fieldset>

      <label className="block space-y-1">
        <span className="sr-only">Ce qui s’est dit</span>
        <textarea
          name="contenu"
          rows={3}
          maxLength={2000}
          placeholder="Ce qui s’est dit, ce qui a été convenu, quand rappeler."
          className={CHAMP}
        />
      </label>

      {!estClient && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-encre-doux">Statut</span>
            <select
              name="statut"
              value={statut}
              onChange={(e) => setStatut(e.target.value)}
              className={CHAMP}
            >
              <option value="">Inchangé</option>
              <option value="contacte">Contacté</option>
              <option value="perdu">Perdu</option>
            </select>
          </label>

          {statut === 'perdu' && (
            <label className="space-y-1 text-sm">
              <span className="text-encre-doux">Pourquoi</span>
              <select name="motif" required defaultValue="" className={CHAMP}>
                <option value="" disabled>
                  Choisir…
                </option>
                {Object.entries(MOTIFS_PERTE).map(([valeur, libelle]) => (
                  <option key={valeur} value={valeur}>
                    {libelle}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <BoutonAction type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Consigner'}
        </BoutonAction>
        {etat.ok && (
          <span role="status" className="text-sm font-medium text-succes">
            Consigné dans l’historique.
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
