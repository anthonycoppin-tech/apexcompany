'use client';

import { useActionState } from 'react';

import { MessageLigne } from '@/components/message';
import { BoutonAction, CHAMP } from '@/components/ui';
import { REPOS, messageDe } from '@/lib/messages/types';

import { ajouterMembre } from './equipe-actions';

/**
 * Ajouter un membre de l'équipe : le compte et ses rôles en une fois.
 *
 * Replié par défaut : c'est un geste rare, et le tableau des comptes reste ce
 * qu'on vient consulter sur cette page.
 */
export function AjoutMembre() {
  const [etat, action, enCours] = useActionState(ajouterMembre, REPOS);

  return (
    <details className="rounded-carte border border-filet bg-fond p-5">
      <summary className="cursor-pointer font-semibold">Ajouter un membre de l’équipe</summary>

      <form action={action} className="mt-5 max-w-2xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Prénom</span>
            <input name="prenom" required className={CHAMP} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Nom</span>
            <input name="nom" className={CHAMP} />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Adresse email</span>
          <input name="email" type="email" required className={CHAMP} />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Profil</legend>
          {[
            [
              'formateur',
              'Formateur employé',
              'Ses prospects et ses accompagnements, sans argent ni statistiques.',
            ],
            [
              'formateur_admin',
              'Formateur admin',
              'Tout : l’équipe entière, les statistiques et le back-office.',
            ],
            ['admin', 'Admin', 'Le back-office, sans espace formateur.'],
          ].map(([valeur, libelle, detail]) => (
            <label key={valeur} className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="radio"
                name="profil"
                value={valeur}
                required
                defaultChecked={valeur === 'formateur'}
                className="mt-1 accent-accent"
              />
              <span>
                <span className="font-medium">{libelle}</span>
                <span className="block text-xs text-encre-doux">{detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            Mot de passe provisoire{' '}
            <span className="font-normal text-encre-doux">— facultatif, 12 caractères minimum</span>
          </span>
          <input name="mot_de_passe" type="text" autoComplete="off" className={CHAMP} />
          <span className="block text-xs text-encre-faible">
            Sans mot de passe, la personne se connecte par un lien reçu par email. Tant que l’envoi
            d’emails n’est pas branché, donnez-en un et transmettez-le-lui de vive voix.
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <BoutonAction type="submit" disabled={enCours}>
            {enCours ? 'Création…' : 'Créer le compte'}
          </BoutonAction>
          <MessageLigne message={messageDe(etat)} />
        </div>
      </form>
    </details>
  );
}
