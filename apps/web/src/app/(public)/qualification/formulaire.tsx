'use client';

import { useActionState, useState } from 'react';

import { BoutonAction, CHAMP, Carte } from '@/components/ui';
import { ECRANS, MOINS_18 } from '@/lib/qualification/questionnaire';
import { MessageBloc, MessageLigne } from '@/components/message';
import { REPOS, alerte, messageDe } from '@/lib/messages/types';

import { soumettreQualification } from './actions';

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
  const [etat, action, enCours] = useActionState(soumettreQualification, REPOS);
  const [index, setIndex] = useState(0);
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [manque, setManque] = useState<string | null>(null);
  const [refuseMineur, setRefuseMineur] = useState(false);

  // **Un échec de soumission parle de l'instant où l'on a soumis.**
  // `useActionState` garde son état tant qu'on ne resoumet pas : le « Une
  // réponse manque : … » renvoyé par le serveur restait donc affiché pendant
  // qu'on corrigeait, et suivait d'un écran à l'autre. Constaté à l'écran le
  // 14 septembre — le message accueillait le dernier écran avant même qu'on y
  // ait rien saisi. C'est le même défaut que ceux du système de messages : une
  // phrase qui a été vraie et qui ne l'est plus.
  const [perime, setPerime] = useState(false);

  // Le consentement est vérifié **dans le navigateur**, et pas seulement au
  // serveur. L'action le refuse toujours — c'est une API publique — mais lui
  // envoyer un formulaire qu'on sait incomplet ne sert à rien et coûte cher :
  // c'est l'aller-retour qui déclenchait la réinitialisation ci-dessous.
  const [consentement, setConsentement] = useState(false);
  const [manqueConsentement, setManqueConsentement] = useState(false);

  // **React 19 réinitialise le formulaire quand une action se termine.** Nos
  // boutons radio sont contrôlés par `reponses`, mais React ne réécrit
  // `checked` dans le DOM que si la valeur a changé : après un échec, les
  // réponses restaient donc en mémoire et disparaissaient de l'écran. Il
  // fallait tout recliquer — et si on ne le faisait pas, la soumission suivante
  // repartait avec des champs vides, ce qui faisait répondre au serveur sur la
  // première question de l'écran.
  //
  // Remonter les champs après l'action les réaligne sur l'état, qui est la
  // seule source de vérité de ce formulaire.
  // L'ajustement se fait **au rendu**, pas dans un effet : `useActionState`
  // renvoie un nouvel objet à chaque action terminée, il suffit donc de
  // comparer. C'est le motif que React documente pour réagir à un changement,
  // et il évite le rendu en cascade d'un `setState` dans un `useEffect`.
  const [precedent, setPrecedent] = useState(etat);
  const [remontage, setRemontage] = useState(0);

  if (precedent !== etat) {
    setPrecedent(etat);
    setRemontage((n) => n + 1);
  }

  const ecran = ECRANS[index];
  const dernier = index === ECRANS.length - 1;

  // Le récapitulatif posé à côté du bouton : c'est là qu'on a cliqué, donc là
  // qu'on attend une réponse. Il nomme la question plutôt que de dire « des
  // champs sont vides », ce qui oblige à les chercher.
  const questionManquante = ecran.questions.find((q) => q.champ === manque);

  const messageBloquant = manqueConsentement
    ? alerte('Cochez la case : sans votre accord, nous ne pouvons pas créer votre compte.')
    : questionManquante
      ? alerte(`Il manque une réponse : « ${questionManquante.libelle} »`)
      : null;

  function repondre(champ: string, valeur: string) {
    setReponses((r) => ({ ...r, [champ]: valeur }));
    setManque(null);
    setPerime(true);
  }

  // `manque` désigne une question de l'écran courant : il n'a aucun sens sur le
  // suivant, et le laisser traverser, c'est afficher un reproche sur un écran
  // qu'on vient d'ouvrir.
  function allerA(i: number) {
    setIndex(i);
    setManque(null);
    setPerime(true);
  }

  function suivant() {
    for (const question of ecran.questions) {
      if (!reponses[question.champ]?.trim()) {
        setManque(question.champ);

        // **Sans ceci, « Continuer » n'a l'air de rien faire.** Le message
        // s'affiche sous la question concernée, qui peut être hors de l'écran
        // quand on clique depuis le bas de la page : on reste devant un bouton
        // qui semble cassé. Déplacer le focus règle les deux à la fois — la
        // page défile jusqu'au champ, et un lecteur d'écran l'annonce au lieu
        // de laisser croire que rien ne s'est passé.
        const champ = document.querySelector<HTMLElement>(`[name="${question.champ}"]`);
        champ?.focus({ preventScroll: true });
        champ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
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

    allerA(Math.min(index + 1, ECRANS.length - 1));
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
    <form
      action={action}
      onSubmit={(e) => {
        // `preventDefault` annule bien l'action serveur d'un `<form action>` :
        // rien ne part, donc rien n'est réinitialisé, donc rien n'est effacé.
        if (!consentement) {
          e.preventDefault();
          setManqueConsentement(true);
          return;
        }
        setPerime(false);
      }}
      // **Entrée ne doit pas soumettre un formulaire à moitié rempli.** Le
      // dernier écran porte le seul bouton de soumission, donc une touche
      // Entrée frappée n'importe où y part au serveur — et revient avec un
      // reproche sur une question qu'on n'a pas encore atteinte.
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !dernier && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          suivant();
        }
      }}
      className="space-y-8"
    >
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
        <div key={`${e.id}-${remontage}`} className={i === index ? 'space-y-6' : 'hidden'}>
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

              <MessageLigne
                message={
                  manque === question.champ
                    ? alerte('Cette réponse est nécessaire pour continuer.')
                    : null
                }
              />
            </fieldset>
          ))}
        </div>
      ))}

      {dernier && (
        <label className="flex cursor-pointer items-start gap-3 rounded-douce border border-filet bg-surface p-4 text-sm leading-relaxed">
          {/* Jamais pré-cochée : une case déjà remplie n'est pas un consentement. */}
          <input
            key={`consentement-${remontage}`}
            type="checkbox"
            name="consentement"
            checked={consentement}
            onChange={(ev) => {
              setConsentement(ev.target.checked);
              setManqueConsentement(false);
            }}
            className="mt-1 accent-accent"
          />
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

      <MessageBloc message={perime ? null : messageDe(etat)} />

      <div className="flex flex-wrap items-center gap-4 border-t border-filet pt-6">
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
            onClick={() => allerA(index - 1)}
            className="text-sm text-encre-doux underline hover:text-encre"
          >
            Retour
          </button>
        )}

        <MessageLigne message={messageBloquant} />
      </div>
    </form>
  );
}
