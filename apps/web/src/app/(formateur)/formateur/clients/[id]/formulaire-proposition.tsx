'use client';

import { useActionState, useState } from 'react';

import { formaterMontant } from '@apex/db';

import { BoutonAction, CHAMP } from '@/components/ui';

import { emettreProposition, type EtatProposition } from './actions';

const ETAT_INITIAL: EtatProposition = { erreur: null, ok: false };

type Formation = {
  id: string;
  titre: string;
  prix_cents: number;
  devise: string;
  type_produit: string;
  modalite: string;
};

const TYPES: Record<string, string> = {
  abonnement: 'Abonnement mensuel',
  accompagnement: 'Accompagnement',
  formation: 'Formation',
};

/**
 * Émission d'une proposition, depuis la fiche client.
 *
 * Le tarif catalogue s'affiche à côté de chaque produit et sert de valeur par
 * défaut au montant proposé — un champ laissé vide vaut « le tarif affiché ».
 * La remise est libre et sans plafond depuis le 8 septembre 2026 : ce qui la
 * tient n'est pas une limite mais une trace, l'écart avec le catalogue partant
 * dans l'historique du prospect.
 *
 * Ces prix sont ceux du catalogue, publics sur la fiche produit. Ce que le
 * client a réellement payé, lui, reste fermé au formateur.
 */
export function FormulaireProposition({
  leadId,
  formations,
  sansCompte,
}: {
  leadId: string;
  formations: Formation[];
  sansCompte: boolean;
}) {
  const [etat, action, enCours] = useActionState(emettreProposition, ETAT_INITIAL);
  const [choisieId, setChoisieId] = useState<string | null>(null);
  const [montant, setMontant] = useState('');

  const choisie = formations.find((f) => f.id === choisieId) ?? null;

  if (sansCompte) {
    return (
      <p className="rounded-douce border border-dashed border-filet-fort bg-surface p-4 text-sm leading-relaxed text-encre-doux">
        Cette personne n’a pas de compte : une proposition ne pourrait pas lui être présentée. Elle
        en obtient un en passant par le formulaire de qualification.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-5 rounded-carte border border-filet bg-fond p-5">
      <input type="hidden" name="lead_id" value={leadId} />

      <fieldset className="space-y-2">
        <legend className="mb-2 font-medium">Produit proposé</legend>
        {formations.map((f) => (
          <label
            key={f.id}
            className="flex cursor-pointer items-baseline gap-3 rounded-douce border border-filet px-4 py-3 text-sm transition-colors hover:bg-surface has-checked:border-accent has-checked:bg-accent-doux"
          >
            <input
              type="radio"
              name="formation_id"
              value={f.id}
              required
              onChange={() => setChoisieId(f.id)}
              className="accent-accent"
            />
            <span className="flex-1">
              {f.titre}
              <span className="text-encre-doux">
                {' '}
                · {TYPES[f.type_produit] ?? f.type_produit} ·{' '}
                {f.modalite === 'individuel' ? 'individuel' : 'groupe'}
              </span>
            </span>
            <span className="font-medium tabular-nums">
              {formaterMontant(f.prix_cents, f.devise)}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-end gap-6">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">Montant proposé</span>
          <span className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              name="montant_euros"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder={choisie ? (choisie.prix_cents / 100).toString() : 'tarif catalogue'}
              className={`${CHAMP} w-32 tabular-nums`}
            />
            €
          </span>
          {/* Le prix catalogue est un défaut, pas une limite : Franck décide
              seul du prix qu'il propose. Ce qui remplace le plafond, c'est la
              trace — l'écart part dans l'historique du prospect. */}
          <span className="block text-xs text-encre-faible">
            {choisie
              ? `Tarif catalogue : ${formaterMontant(choisie.prix_cents, choisie.devise)}. Laisser vide pour l’appliquer.`
              : 'Choisis d’abord un produit.'}
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          Valable
          <input
            type="number"
            name="validite_jours"
            defaultValue={7}
            min={1}
            max={90}
            className={`${CHAMP} w-20 tabular-nums`}
          />
          jours
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <BoutonAction type="submit" disabled={enCours}>
          {enCours ? 'Envoi…' : 'Émettre la proposition'}
        </BoutonAction>
        {etat.ok && (
          <span role="status" className="text-sm font-medium text-succes">
            Proposition envoyée. Elle apparaît dans son espace.
          </span>
        )}
        {etat.erreur && (
          <span role="alert" className="text-sm text-alerte">
            {etat.erreur}
          </span>
        )}
      </div>

      <p className="text-xs text-encre-faible">
        La nouvelle proposition périme celle qui était en cours : une seule est valable à la fois.
      </p>
    </form>
  );
}
