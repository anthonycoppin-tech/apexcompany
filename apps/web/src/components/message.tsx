import type { Message, Ton } from '@/lib/messages/types';

/**
 * Le rendu d'un message — le seul du site.
 *
 * **Le rôle ARIA se déduit du ton, il ne se passe pas en propriété.** C'est
 * tout l'intérêt du composant : `role="alert"` pour ce qui a échoué,
 * `role="status"` pour le reste. Avant, le rôle était écrit à la main à vingt-
 * sept endroits — et manquait aux deux qui comptaient le plus, « Paiement
 * reçu » et « Paiement interrompu », tous deux affichés sans être annoncés.
 *
 * `role="alert"` implique déjà `aria-live="assertive"` et `role="status"`
 * implique `aria-live="polite"` : les doubler n'ajoute rien et fait annoncer
 * deux fois sur certains lecteurs.
 *
 * Ni `'use client'` ni état : le composant rend ce qu'on lui donne, et s'utilise
 * des deux côtés de la frontière.
 */

const ROLES: Record<Ton, 'alert' | 'status'> = {
  succes: 'status',
  info: 'status',
  alerte: 'alert',
};

const BLOC: Record<Ton, string> = {
  succes: 'border-succes bg-succes-doux text-succes',
  alerte: 'border-alerte bg-alerte-doux text-alerte',
  info: 'border-filet-fort bg-surface text-encre',
};

/**
 * La taille passe par une propriété, **jamais par `className`** — même raison
 * que la largeur de `Conteneur` : deux utilitaires de la même famille ne se
 * départagent pas par l'ordre où on les écrit ici, mais par leur ordre dans la
 * feuille générée. Un appelant qui passerait `className="text-xs"` obtiendrait
 * `text-sm` en silence.
 */
const TAILLES = {
  normale: 'text-sm',
  petite: 'text-xs',
} as const;

const LIGNE: Record<Ton, string> = {
  succes: 'text-succes font-medium',
  alerte: 'text-alerte',
  info: 'text-encre-doux',
};

/**
 * Un bandeau, en tête de page ou de carte. Pour ce qui vient de se passer et
 * qui concerne l'écran entier — un retour de paiement, une liaison Discord.
 */
export function MessageBloc({
  message,
  className = '',
}: {
  message: Message | null;
  className?: string;
}) {
  if (!message) return null;

  return (
    <p
      role={ROLES[message.ton]}
      className={`rounded-douce border p-4 text-sm leading-relaxed ${BLOC[message.ton]} ${className}`}
    >
      {message.texte}
    </p>
  );
}

/**
 * Le même message, à côté d'un bouton de soumission. Pour ce qui concerne le
 * formulaire qu'on vient d'envoyer, et lui seul.
 *
 * En `<span>` : il vit dans une rangée à côté du bouton, où un `<p>` casserait
 * l'alignement.
 */
export function MessageLigne({
  message,
  taille = 'normale',
  className = '',
}: {
  message: Message | null;
  taille?: keyof typeof TAILLES;
  className?: string;
}) {
  if (!message) return null;

  return (
    <span
      role={ROLES[message.ton]}
      className={`${TAILLES[taille]} ${LIGNE[message.ton]} ${className}`}
    >
      {message.texte}
    </span>
  );
}
