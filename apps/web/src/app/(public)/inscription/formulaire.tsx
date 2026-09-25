'use client';

import { useActionState, useState } from 'react';

import { lancerLiaisonDiscord } from '@/components/bouton-lier-discord';
import { MessageLigne } from '@/components/message';
import { CHAMP_PIEGE } from '@/lib/qualification/anti-spam';
import { REPOS, alerte, messageDe, type EtatAction, type Message } from '@/lib/messages/types';

import { inscrire } from './actions';

const CHAMP = 'w-full rounded-douce border border-filet-fort p-2.5';

/**
 * Le formulaire d'inscription directe, puis Discord dans la foulée.
 *
 * La liaison Discord est lancée **par le navigateur** dès que le compte existe :
 * `linkIdentity` est un aller-retour OAuth qui doit partir de la page, avec la
 * session que l'action vient de poser. Si elle ne part pas (bloqueur,
 * Discord indisponible), la personne n'est pas perdue : son compte existe, et
 * le bouton reste là — de même que dans `/espace/communaute`.
 */
export function FormulaireInscription({ src }: { src?: string }) {
  const [liaison, setLiaison] = useState<'attente' | 'depart' | 'echec'>('attente');
  const [messageLiaison, setMessageLiaison] = useState<Message | null>(null);

  async function partirVersDiscord() {
    setLiaison('depart');
    setMessageLiaison(null);
    const { echec } = await lancerLiaisonDiscord();
    if (echec) {
      setLiaison('echec');
      setMessageLiaison(
        alerte('La connexion à Discord n’a pas abouti. Réessayez, ou faites-le plus tard.'),
      );
    }
  }

  // Discord part dès que le compte existe, dans le prolongement de l'envoi :
  // les cookies de session posés par l'action sont déjà dans le navigateur
  // quand elle rend la main. Une seule tentative automatique — relancer en
  // boucle un OAuth qui échoue enfermerait la personne sur cette page.
  const [etat, action, enCours] = useActionState(
    async (precedent: EtatAction, donnees: FormData) => {
      const resultat = await inscrire(precedent, donnees);
      if (resultat.statut === 'succes') await partirVersDiscord();
      return resultat;
    },
    REPOS,
  );

  const cree = etat.statut === 'succes';

  if (cree) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Votre compte est créé</h2>
        <p className="leading-relaxed text-encre-doux">
          Dernière étape : connecter votre compte Discord. Vous y recevez tout de suite l’accès
          invité à la communauté.
        </p>
        <button
          type="button"
          onClick={partirVersDiscord}
          disabled={liaison === 'depart'}
          className="inline-flex items-center justify-center rounded-douce bg-discord px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-discord-fort disabled:cursor-not-allowed disabled:opacity-50"
        >
          {liaison === 'depart' ? 'Redirection vers Discord…' : 'Connecter mon compte Discord'}
        </button>
        <MessageLigne message={messageLiaison} />
        <p className="text-sm text-encre-doux">
          Pas de compte Discord ?{' '}
          <a href="/espace" className="text-accent hover:underline">
            Continuer vers mon espace
          </a>
          , vous pourrez le connecter plus tard.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="src" value={src ?? ''} />

      {/* Champ piège : voir le formulaire de qualification, même règle. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Ne pas remplir
          <input type="text" name={CHAMP_PIEGE} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Prénom</span>
        <input name="prenom" required autoComplete="given-name" className={CHAMP} />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Adresse email</span>
        <input name="email" type="email" required autoComplete="email" className={CHAMP} />
        <span className="block text-xs text-encre-doux">
          C’est elle qui vous connecte : vous recevrez un lien, sans mot de passe à retenir.
        </span>
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">
          Téléphone <span className="font-normal text-encre-doux">— facultatif</span>
        </span>
        <input name="telephone" type="tel" autoComplete="tel" className={CHAMP} />
      </label>

      {/* Jamais pré-cochées : une case déjà remplie n'est ni un consentement ni
          une déclaration. */}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="majeur" required className="mt-1" />
        <span>J’ai 18 ans ou plus.</span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consentement" required className="mt-1" />
        <span>
          J’accepte la création de mon compte et le traitement de mes données dans les conditions
          décrites par la{' '}
          <a href="/confidentialite" className="text-accent underline">
            politique de confidentialité
          </a>
          .
        </span>
      </label>

      <MessageLigne message={messageDe(etat)} />

      <button
        type="submit"
        disabled={enCours}
        className="w-full rounded-douce bg-accent px-5 py-3 text-sm font-semibold text-accent-contraste transition-colors hover:bg-accent-fort disabled:opacity-50"
      >
        {enCours ? 'Création du compte…' : 'Créer mon compte'}
      </button>
    </form>
  );
}
