import { CHAMP_CGV, CHAMP_DEMARRAGE, texteDemarrage } from '@/lib/legal/acceptation';

/**
 * Les deux cases à cocher avant tout paiement (`lib/legal/acceptation.ts`).
 *
 * Jamais pré-cochées : une case déjà remplie n'est pas un consentement. Et
 * `required`, pour que le navigateur bloque avant l'aller-retour serveur —
 * React 19 réinitialise un formulaire après une action, et une case décochée
 * par ce biais se reperdrait à chaque échec. L'action revérifie derrière : une
 * action serveur est une API publique.
 *
 * Les liens s'ouvrent dans un nouvel onglet : les lire ne doit pas faire perdre
 * le formulaire.
 */
export function CasesAcceptation({ typeProduit }: { typeProduit: string }) {
  const lien = 'text-accent underline';

  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-start gap-2">
        <input type="checkbox" name={CHAMP_CGV} required className="mt-1" />
        <span>
          J’ai lu et j’accepte les{' '}
          <a href="/cgv" target="_blank" rel="noopener" className={lien}>
            conditions générales de vente
          </a>{' '}
          et l’
          <a href="/avertissement" target="_blank" rel="noopener" className={lien}>
            avertissement sur les risques
          </a>
          .
        </span>
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" name={CHAMP_DEMARRAGE} required className="mt-1" />
        <span>
          {texteDemarrage(typeProduit)}{' '}
          <a href="/remboursement" target="_blank" rel="noopener" className={lien}>
            Ce que cela change
          </a>
        </span>
      </label>
    </div>
  );
}
