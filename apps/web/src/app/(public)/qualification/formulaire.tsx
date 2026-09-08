'use client';

import { useActionState, useState } from 'react';

import { ECRANS, MOINS_18 } from '@/lib/qualification/questionnaire';

import { soumettreQualification, type EtatFormulaire } from './actions';

const ETAT_INITIAL: EtatFormulaire = { erreur: null };

/**
 * Le formulaire de qualification, en cinq écrans.
 *
 * Tous les écrans sont montés en permanence dans le même `<form>`, les
 * inactifs simplement masqués. C'est ce qui permet à la soumission finale de
 * porter l'ensemble des réponses sans état intermédiaire côté serveur : le
 * tunnel n'écrit qu'une fois, à la fin, ce qui évite les leads fantômes de
 * quelqu'un qui abandonne à l'écran 3.
 */
export function FormulaireQualification({ src }: { src?: string }) {
  const [etat, action, enCours] = useActionState(soumettreQualification, ETAT_INITIAL);
  const [index, setIndex] = useState(0);
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [manque, setManque] = useState<string | null>(null);
  const [refuseMineur, setRefuseMineur] = useState(false);

  const ecran = ECRANS[index];
  const dernier = index === ECRANS.length - 1;

  function repondre(champ: string, valeur: string) {
    setReponses((r) => ({ ...r, [champ]: valeur }));
    setManque(null);
  }

  function suivant() {
    for (const question of ecran.questions) {
      if (!reponses[question.champ]?.trim()) {
        setManque(question.champ);
        return;
      }
    }

    // Le refus des moins de 18 ans intervient ici, avant tout envoi : rien
    // n'est parti au serveur, donc rien n'est écrit en base. C'est la raison
    // pour laquelle l'âge est seul sur son écran.
    if (reponses.tranche_age === MOINS_18) {
      setRefuseMineur(true);
      return;
    }

    setIndex((i) => Math.min(i + 1, ECRANS.length - 1));
  }

  if (refuseMineur) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Rendez-vous dans quelques années</h1>
        <p className="text-sm text-neutral-600">
          Nos accompagnements ne sont pas ouverts aux moins de 18 ans. Rien n’a été enregistré.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="src" value={src ?? ''} />

      <div className="space-y-1">
        <p className="text-xs text-neutral-500">
          Étape {index + 1} sur {ECRANS.length}
        </p>
        <h1 className="text-2xl font-semibold">{ecran.titre}</h1>
      </div>

      {ECRANS.map((e, i) => (
        <div key={e.id} className={i === index ? 'space-y-6' : 'hidden'}>
          {e.questions.map((question) => (
            <fieldset key={question.champ} className="space-y-2">
              <legend className="text-sm font-medium">{question.libelle}</legend>

              {question.type === 'choix' ? (
                <div className="space-y-1">
                  {question.options.map((option) => (
                    <label key={option.valeur} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={question.champ}
                        value={option.valeur}
                        checked={reponses[question.champ] === option.valeur}
                        onChange={() => repondre(question.champ, option.valeur)}
                      />
                      {option.libelle}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  type={question.type}
                  name={question.champ}
                  value={reponses[question.champ] ?? ''}
                  onChange={(ev) => repondre(question.champ, ev.target.value)}
                  className="w-full max-w-sm rounded border p-2 text-sm"
                />
              )}

              {manque === question.champ && (
                <p className="text-sm text-red-600">Cette réponse est nécessaire pour continuer.</p>
              )}
            </fieldset>
          ))}
        </div>
      ))}

      {dernier && (
        <label className="flex items-start gap-2 text-sm">
          {/* Jamais pré-cochée : une case déjà remplie n'est pas un consentement. */}
          <input type="checkbox" name="consentement" className="mt-1" />
          <span>
            J’accepte que mes réponses soient utilisées pour préparer mon audit et créer mon compte,
            dans les conditions décrites par la{' '}
            <a href="/confidentialite" className="underline">
              politique de confidentialité
            </a>
            .
          </span>
        </label>
      )}

      {etat.erreur && <p className="text-sm text-red-600">{etat.erreur}</p>}

      <div className="flex items-center gap-3">
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex((i) => i - 1)}
            className="text-sm underline"
          >
            Retour
          </button>
        )}

        {dernier ? (
          <button
            type="submit"
            disabled={enCours}
            className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {enCours ? 'Envoi…' : 'Voir les créneaux d’audit'}
          </button>
        ) : (
          <button
            type="button"
            onClick={suivant}
            className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Continuer
          </button>
        )}
      </div>
    </form>
  );
}
