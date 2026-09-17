'use client';

import { useActionState, useState } from 'react';

import { MessageLigne } from '@/components/message';
import { BoutonAction, CHAMP } from '@/components/ui';
import { TYPES_NOTE, type TypeNote } from '@/lib/formateur/suivi';
import { REPOS, messageDe } from '@/lib/messages/types';

import { ajouterNote, changerVisibilite, supprimerNote } from './notes-actions';

export type Note = {
  id: string;
  type: TypeNote;
  contenu: string;
  visible_client: boolean;
  created_at: string;
  formateur_id: string;
};

/**
 * Écrire une note de suivi.
 *
 * Le type pré-coche la visibilité — un objectif ou un retour de séance est fait
 * pour être lu par le client, une observation non —, mais la case reste la
 * décision : c'est elle qu'on lit en dernier avant d'enregistrer, et son
 * libellé dit exactement ce qu'elle fait.
 */
export function FormulaireNote({ inscriptionId }: { inscriptionId: string }) {
  const [type, setType] = useState<TypeNote>('retour');
  const [visible, setVisible] = useState(true);

  const [etat, action, enCours] = useActionState(
    async (precedent: Parameters<typeof ajouterNote>[0], donnees: FormData) => {
      const resultat = await ajouterNote(precedent, donnees);
      // React vide les champs non contrôlés après l'action ; les deux choix
      // contrôlés reviennent à leur défaut au même moment.
      if (resultat.statut === 'succes') {
        setType('retour');
        setVisible(true);
      }
      return resultat;
    },
    REPOS,
  );

  return (
    <form action={action} className="space-y-4 rounded-carte border border-filet bg-fond p-5">
      <input type="hidden" name="inscription_id" value={inscriptionId} />

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Type de note</legend>
        {(Object.entries(TYPES_NOTE) as Array<[TypeNote, string]>).map(([valeur, libelle]) => (
          <label
            key={valeur}
            className="flex cursor-pointer items-center gap-2 rounded-douce border border-filet px-3 py-2 text-sm transition-colors hover:bg-surface has-checked:border-accent has-checked:bg-accent-doux"
          >
            <input
              type="radio"
              name="type"
              value={valeur}
              checked={type === valeur}
              onChange={() => {
                setType(valeur);
                setVisible(valeur !== 'observation');
              }}
              className="accent-accent"
            />
            {libelle}
          </label>
        ))}
      </fieldset>

      <label className="block space-y-1">
        <span className="sr-only">Contenu de la note</span>
        <textarea
          name="contenu"
          rows={4}
          maxLength={4000}
          required
          placeholder={
            type === 'objectif'
              ? 'Ce que le client vise d’ici la prochaine étape, mesurable si possible.'
              : type === 'retour'
                ? 'Ce qui a été travaillé, ce qui progresse, ce qu’il faut faire d’ici la prochaine séance.'
                : 'Ce que vous remarquez, pour vous ou pour un collègue qui reprendrait le suivi.'
          }
          className={CHAMP}
        />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="visible_client"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
          className="mt-0.5 accent-accent"
        />
        <span>
          <span className="font-medium">Visible par le client</span>{' '}
          <span className="text-encre-doux">
            — la note apparaîtra dans son espace. Décochée, elle reste interne.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <BoutonAction type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer la note'}
        </BoutonAction>
        <MessageLigne message={messageDe(etat)} />
      </div>
    </form>
  );
}

/**
 * Les notes d'un accompagnement, les plus récentes en tête.
 *
 * Seul l'auteur d'une note peut la rendre visible, la masquer ou la supprimer
 * — la base refuse le reste. Masquer est le geste de rattrapage d'une note
 * partagée par erreur : il agit tout de suite, sans confirmation. Supprimer,
 * qui ne se rattrape pas, demande deux clics.
 */
export function ListeNotes({ notes, moi }: { notes: Note[]; moi: string | null }) {
  if (!notes.length) {
    return (
      <p className="rounded-carte border border-dashed border-filet p-5 text-sm text-encre-doux">
        Aucune note pour l’instant. Un premier objectif écrit ici apparaît aussi dans l’espace du
        client.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {notes.map((n) => (
        <li key={n.id} className="space-y-2 rounded-carte border border-filet bg-fond p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wide text-encre-faible uppercase">
                {TYPES_NOTE[n.type]}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  n.visible_client
                    ? 'bg-accent-doux text-encre'
                    : 'bg-surface-forte text-encre-doux'
                }`}
              >
                {n.visible_client ? 'Visible par le client' : 'Interne'}
              </span>
            </span>
            <span className="text-xs text-encre-doux">
              {new Date(n.created_at).toLocaleString('fr-FR', {
                timeZone: 'Europe/Paris',
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>
          <p className="whitespace-pre-wrap">{n.contenu}</p>
          {n.formateur_id === moi && <ActionsNote note={n} />}
        </li>
      ))}
    </ul>
  );
}

function ActionsNote({ note }: { note: Note }) {
  const [confirmer, setConfirmer] = useState(false);
  const [etatVisibilite, basculer, bascule] = useActionState(changerVisibilite, REPOS);
  const [etatSuppression, supprimer, supprime] = useActionState(supprimerNote, REPOS);

  const lien = 'font-medium text-encre-doux underline hover:text-encre disabled:opacity-50';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <form action={basculer}>
        <input type="hidden" name="note_id" value={note.id} />
        <input type="hidden" name="visible" value={String(!note.visible_client)} />
        <button type="submit" disabled={bascule} className={lien}>
          {note.visible_client ? 'Masquer au client' : 'Rendre visible au client'}
        </button>
      </form>

      <form action={supprimer} className="flex items-center gap-2">
        <input type="hidden" name="note_id" value={note.id} />
        {confirmer ? (
          <>
            <button
              type="submit"
              disabled={supprime}
              className="font-semibold text-alerte underline"
            >
              Confirmer la suppression
            </button>
            <button type="button" onClick={() => setConfirmer(false)} className={lien}>
              Annuler
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmer(true)} className={lien}>
            Supprimer
          </button>
        )}
      </form>

      <MessageLigne message={messageDe(etatVisibilite) ?? messageDe(etatSuppression)} />
    </div>
  );
}
