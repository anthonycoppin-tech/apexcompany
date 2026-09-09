'use client';

import { useActionState, useState } from 'react';

import { BoutonAction, CHAMP, Carte } from '@/components/ui';
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
      <Carte className="space-y-3">
        <h1 className="text-2xl font-extrabold">Rendez-vous dans quelques années</h1>
        <p className="leading-relaxed text-encre-doux">
          Nos accompagnements ne sont pas ouverts aux moins de 18 ans. Rien n’a été enregistré.
        </p>
      </Carte>
    );
  }

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="src" value={src ?? ''} />

      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-wide text-encre-faible uppercase">
          Étape {index + 1} sur {ECRANS.length}
        </p>

        {/* Cinq écrans sans jauge, c'est cinq occasions de se demander combien
            il en reste. Le `div` extérieur porte les rôles ARIA : la barre
            elle-même n'est qu'un remplissage décoratif. */}
        <div
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={ECRANS.length}
          aria-label="Progression du questionnaire"
          className="h-1 w-full overflow-hidden rounded-douce bg-surface-forte"
        >
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${((index + 1) / ECRANS.length) * 100}%` }}
          />
        </div>

        <h1 className="text-3xl font-extrabold">{ecran.titre}</h1>
      </div>

      {ECRANS.map((e, i) => (
        <div key={e.id} className={i === index ? 'space-y-6' : 'hidden'}>
          {e.questions.map((question) => (
            <fieldset key={question.champ} className="space-y-3">
              <legend className="font-medium">{question.libelle}</legend>

              {question.type === 'choix' ? (
                <div className="space-y-2">
                  {question.options.map((option) => (
                    // Toute la ligne est cliquable, pas seulement le rond : sur
                    // mobile, viser un bouton radio de 16 pixels est le meilleur
                    // moyen de perdre quelqu'un au troisième écran.
                    <label
                      key={option.valeur}
                      className="flex cursor-pointer items-center gap-3 rounded-douce border border-filet px-4 py-3 text-sm transition-colors hover:border-filet-fort hover:bg-surface has-checked:border-accent has-checked:bg-accent-doux"
                    >
                      <input
                        type="radio"
                        name={question.champ}
                        value={option.valeur}
                        checked={reponses[question.champ] === option.valeur}
                        onChange={() => repondre(question.champ, option.valeur)}
                        className="accent-accent"
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
                  aria-invalid={manque === question.champ}
                  className={CHAMP}
                />
              )}

              {manque === question.champ && (
                <p role="alert" className="text-sm text-alerte">
                  Cette réponse est nécessaire pour continuer.
                </p>
              )}
            </fieldset>
          ))}
        </div>
      ))}

      {dernier && (
        <label className="flex cursor-pointer items-start gap-3 rounded-douce border border-filet bg-surface p-4 text-sm leading-relaxed">
          {/* Jamais pré-cochée : une case déjà remplie n'est pas un consentement. */}
          <input type="checkbox" name="consentement" className="mt-1 accent-accent" />
          <span>
            J’accepte que mes réponses soient utilisées pour préparer mon audit et créer mon compte,
            dans les conditions décrites par la{' '}
            <a href="/confidentialite" className="text-accent underline">
              politique de confidentialité
            </a>
            .
          </span>
        </label>
      )}

      {etat.erreur && (
        <p role="alert" className="text-sm text-alerte">
          {etat.erreur}
        </p>
      )}

      <div className="flex items-center gap-4 border-t border-filet pt-6">
        {dernier ? (
          <BoutonAction type="submit" disabled={enCours}>
            {enCours ? 'Envoi…' : 'Voir les créneaux d’audit'}
          </BoutonAction>
        ) : (
          <BoutonAction type="button" onClick={suivant}>
            Continuer
          </BoutonAction>
        )}

        {/* Le retour est après l'action principale et sans habillage de bouton :
            c'est une issue de secours, pas le chemin qu'on propose. */}
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex((i) => i - 1)}
            className="text-sm text-encre-doux underline hover:text-encre"
          >
            Retour
          </button>
        )}
      </div>
    </form>
  );
}
