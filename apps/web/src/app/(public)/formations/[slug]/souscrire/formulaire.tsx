'use client';

import { useActionState } from 'react';

import { souscrire, type EtatSouscription } from './actions';

const ETAT_INITIAL: EtatSouscription = { erreur: null };

/**
 * Le formulaire de souscription directe.
 *
 * Trois champs quand la personne n'a pas de compte, aucun quand elle en a un.
 * Le questionnaire de qualification n'a pas lieu d'être ici : il sert à
 * préparer un audit qui n'aura pas lieu, et le poser devant un abonnement
 * mensuel coûterait exactement ce que la vente en self-service cherche à
 * gagner.
 */
export function FormulaireSouscription({
  slug,
  connecte,
  libelleBouton,
}: {
  slug: string;
  connecte: boolean;
  libelleBouton: string;
}) {
  const [etat, action, enCours] = useActionState(souscrire, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />

      {!connecte && (
        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Prénom</span>
            <input
              name="prenom"
              required
              autoComplete="given-name"
              className="w-full rounded-douce border border-filet-fort p-2.5"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">Adresse email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-douce border border-filet-fort p-2.5"
            />
            <span className="block text-xs text-encre-doux">
              Elle porte l’identité de ton compte et reçoit tes factures.
            </span>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">
              Téléphone <span className="font-normal text-encre-doux">— facultatif</span>
            </span>
            <input
              name="telephone"
              type="tel"
              autoComplete="tel"
              className="w-full rounded-douce border border-filet-fort p-2.5"
            />
          </label>

          {/* Jamais pré-cochée : une case déjà remplie n'est pas un consentement. */}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="consentement" className="mt-1" />
            <span>
              J’accepte la création de mon compte et le traitement de mes données dans les
              conditions décrites par la{' '}
              <a href="/confidentialite" className="text-accent underline">
                politique de confidentialité
              </a>
              .
            </span>
          </label>
        </div>
      )}

      {etat.erreur && <p className="text-sm text-alerte">{etat.erreur}</p>}

      <button
        type="submit"
        disabled={enCours}
        className="w-full rounded-douce bg-accent px-5 py-3 text-sm font-semibold text-accent-contraste transition-colors hover:bg-accent-fort disabled:opacity-50"
      >
        {enCours ? 'Ouverture du paiement…' : libelleBouton}
      </button>

      <p className="text-center text-xs text-encre-doux">
        Paiement sécurisé par Stripe. Résiliable à tout moment depuis ton espace.
      </p>
    </form>
  );
}
