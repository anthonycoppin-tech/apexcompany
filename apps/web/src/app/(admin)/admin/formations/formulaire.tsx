'use client';

import { useActionState, useState } from 'react';

import { MessageBloc, MessageLigne } from '@/components/message';
import { REPOS, alerte, messageDe } from '@/lib/messages/types';

import { enregistrerFormation } from './actions';

export type FormationEditable = {
  id: string;
  titre: string;
  slug: string;
  description: string | null;
  objectifs_pedagogiques: string | null;
  prerequis: string | null;
  type_produit: string;
  modalite: string;
  prix_cents: number;
  duree_acces_jours: number | null;
  duree_semaines: number | null;
  volume_horaire: number | null;
  discord_role_id: string | null;
  actif: boolean;
  ordre: number;
};

const TYPES = [
  { valeur: 'abonnement', libelle: 'Abonnement', acces: 'Repoussé à chaque prélèvement' },
  { valeur: 'accompagnement', libelle: 'Accompagnement', acces: 'Durée fixe, à déclarer' },
  { valeur: 'formation', libelle: 'Formation', acces: 'Illimité' },
] as const;

/**
 * Un champ du formulaire.
 *
 * **`obligatoire` est écrit, pas sous-entendu.** Rien ne distinguait un champ
 * requis d'un champ facultatif : on le découvrait en cliquant sur « Créer le
 * produit » et en ne voyant rien se passer. Le site marque déjà le contraire
 * ailleurs (« Téléphone — facultatif » sur la souscription) ; ici la majorité
 * des champs est facultative, donc c'est l'exception qu'on signale.
 *
 * `data-libelle` sert au récapitulatif de soumission : sans lui, il faudrait
 * relire le contenu du `<label>`, qui porte aussi le texte d'aide.
 */
const Champ = ({
  nom,
  libelle,
  aide,
  ...props
}: {
  nom: string;
  libelle: string;
  aide?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) => (
  <label className="block space-y-1 text-sm">
    <span className="font-medium">
      {libelle}
      {props.required && <span className="font-normal text-encre-faible"> — obligatoire</span>}
    </span>
    <input
      name={nom}
      data-libelle={libelle}
      {...props}
      className="w-full rounded-douce border border-filet-fort bg-fond p-2 text-sm"
    />
    {aide && <span className="block text-xs text-encre-doux">{aide}</span>}
  </label>
);

/**
 * Le formulaire du catalogue.
 *
 * **La durée d'accès n'apparaît pas pour une formation**, parce qu'elle n'y a
 * aucun sens : son accès est illimité. Elle apparaît pour un accompagnement
 * (la durée totale) et, depuis le 23 septembre 2026, pour un abonnement (la
 * période de facturation) — une même valeur, deux lectures. Le champ est masqué
 * plutôt que grisé : un champ grisé invite à chercher comment l'activer, un
 * champ absent dit qu'il n'y a rien à remplir.
 *
 * C'est aussi la seule façon d'éviter qu'un champ resté rempli après un
 * changement de type ne parte en base et ne se fasse refuser par la contrainte.
 */
export function FormulaireFormation({ formation }: { formation?: FormationEditable }) {
  const [etat, action, enCours] = useActionState(enregistrerFormation, REPOS);
  const [type, setType] = useState(formation?.type_produit ?? 'accompagnement');
  const [publie, setPublie] = useState(formation?.actif ?? false);
  const [role, setRole] = useState(formation?.discord_role_id ?? '');

  const typeChoisi = TYPES.find((t) => t.valeur === type);

  // Ce qui manque au moment où l'on a cliqué. Effacé à la moindre saisie : un
  // reproche qui survit à sa correction est le défaut qu'on passe la semaine à
  // retirer du reste du site.
  const [manquants, setManquants] = useState<string[]>([]);

  return (
    <form
      action={action}
      onChange={() => setManquants([])}
      // **La validation native ne dit rien d'utilisable ici.** Sa bulle est
      // dans la langue du navigateur, elle disparaît au premier clic, et elle
      // ne s'affiche pas du tout si le champ fautif est masqué — ce qui arrive
      // dans ce formulaire, où la durée d'accès disparaît pour une formation.
      // On garde la contrainte HTML, qui est la source de vérité, et on la rend
      // visible avec nos propres moyens.
      noValidate
      onSubmit={(e) => {
        const invalides = Array.from(
          e.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement>(':invalid'),
        );

        if (invalides.length === 0) return;

        e.preventDefault();
        setManquants(invalides.map((c) => c.dataset.libelle ?? c.name));

        const premier = invalides[0];
        premier.focus({ preventScroll: true });
        premier.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }}
      className="space-y-8"
    >
      {formation && <input type="hidden" name="id" value={formation.id} />}

      <section className="grid gap-5 rounded-carte border border-filet bg-fond p-5 sm:grid-cols-2">
        <Champ nom="titre" libelle="Titre" defaultValue={formation?.titre} required />
        <Champ
          nom="slug"
          libelle="Adresse (slug)"
          defaultValue={formation?.slug}
          required
          aide="Minuscules, chiffres et tirets. Change l’adresse publique du produit."
        />

        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium">Description</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={formation?.description ?? ''}
            className="w-full rounded-douce border border-filet-fort bg-fond p-2 text-sm"
          />
          <span className="block text-xs text-encre-doux">
            Affichée sur la fiche produit et dans le catalogue public.
          </span>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Objectifs pédagogiques</span>
          <textarea
            name="objectifs_pedagogiques"
            rows={4}
            defaultValue={formation?.objectifs_pedagogiques ?? ''}
            className="w-full rounded-douce border border-filet-fort bg-fond p-2 text-sm"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Prérequis</span>
          <textarea
            name="prerequis"
            rows={4}
            defaultValue={formation?.prerequis ?? ''}
            className="w-full rounded-douce border border-filet-fort bg-fond p-2 text-sm"
          />
        </label>
      </section>

      <section className="space-y-5 rounded-carte border border-filet bg-fond p-5">
        <h2 className="text-sm font-semibold">Comment ça se paie, comment ça donne accès</h2>

        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Type de produit</span>
            <select
              name="type_produit"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-douce border border-filet-fort bg-fond p-2 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.valeur} value={t.valeur}>
                  {t.libelle}
                </option>
              ))}
            </select>
            <span className="block text-xs text-encre-doux">Accès : {typeChoisi?.acces}</span>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">Suivi</span>
            <select
              name="modalite"
              defaultValue={formation?.modalite ?? 'groupe'}
              className="w-full rounded-douce border border-filet-fort bg-fond p-2 text-sm"
            >
              <option value="groupe">En groupe</option>
              <option value="individuel">Individuel</option>
            </select>
            <span className="block text-xs text-encre-doux">
              Information seulement — ne change rien à l’accès.
            </span>
          </label>

          <Champ
            nom="prix_euros"
            libelle={type === 'abonnement' ? 'Tarif par période (€)' : 'Tarif (€)'}
            type="text"
            inputMode="decimal"
            defaultValue={formation ? (formation.prix_cents / 100).toString() : ''}
            required
          />
        </div>

        {/* Le champ n'existe que là où il a un sens : un champ absent dit qu'il
            n'y a rien à remplir, là où un champ grisé invite à chercher comment
            l'activer. */}
        {(type === 'accompagnement' || type === 'abonnement') && (
          <Champ
            nom="duree_acces_jours"
            libelle={
              type === 'abonnement' ? 'Période de facturation (jours)' : 'Durée d’accès (jours)'
            }
            type="number"
            min={1}
            defaultValue={formation?.duree_acces_jours ?? ''}
            required
            aide={
              type === 'abonnement'
                ? '30 pour du mensuel, 365 pour de l’annuel. C’est à la fois le rythme des prélèvements et la durée que chacun repousse — sans elle, l’accès serait illimité.'
                : '30, 60, 90 ou 180 selon la formule. C’est elle qui fixe la date de fin d’accès.'
            }
          />
        )}
      </section>

      <section className="space-y-5 rounded-carte border border-filet bg-fond p-5">
        <h2 className="text-sm font-semibold">Accès Discord et publication</h2>

        <Champ
          nom="discord_role_id"
          libelle="Identifiant du rôle Discord"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aide="Le rôle attribué à l’inscription et retiré en fin d’accès."
        />

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="actif"
            checked={publie}
            onChange={(e) => setPublie(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Publié</span>
            <span className="block text-xs text-encre-doux">
              Visible dans le catalogue public et achetable.
            </span>
          </span>
        </label>

        {/* Le pire scénario du système : un produit qui se vend, s'encaisse et
            n'ouvre aucun accès. On peut préparer un brouillon sans rôle, on ne
            peut pas le publier. */}
        {publie && !role && (
          <MessageBloc
            message={alerte(
              'Sans rôle Discord, ce produit encaissera un paiement sans ouvrir d’accès. Ajoute le rôle, ou décoche « Publié » pour l’enregistrer en brouillon.',
            )}
          />
        )}

        <div className="grid gap-5 sm:grid-cols-3">
          <Champ
            nom="ordre"
            libelle="Ordre d’affichage"
            type="number"
            min={0}
            defaultValue={formation?.ordre ?? 0}
          />
          <Champ
            nom="duree_semaines"
            libelle="Durée du cursus (semaines)"
            type="number"
            min={0}
            defaultValue={formation?.duree_semaines ?? ''}
          />
          <Champ
            nom="volume_horaire"
            libelle="Volume horaire"
            type="number"
            min={0}
            defaultValue={formation?.volume_horaire ?? ''}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-douce bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contraste hover:bg-accent-fort disabled:opacity-50"
        >
          {enCours ? 'Enregistrement…' : formation ? 'Enregistrer' : 'Créer le produit'}
        </button>
        <MessageLigne
          message={
            manquants.length > 0
              ? alerte(
                  manquants.length === 1
                    ? `Il manque : ${manquants[0]}.`
                    : `Il manque ${manquants.length} champs : ${manquants.join(', ')}.`,
                )
              : messageDe(etat)
          }
        />
      </div>
    </form>
  );
}
