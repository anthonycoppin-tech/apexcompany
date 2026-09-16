'use client';

import { useEffect, useState } from 'react';

import { PARAM, messageFournisseur } from '@/lib/messages/catalogue';
import type { Message } from '@/lib/messages/types';

import { MessageBloc } from './message';

/**
 * Le bandeau porté par l'URL, et le nettoyage qui va avec.
 *
 * **Pourquoi le message arrive en propriété plutôt que d'être résolu ici.**
 * Les codes dépendants ont besoin d'une preuve lue en base (`preuves.ts`), donc
 * d'un composant serveur. La page lit `searchParams`, appelle la fonction de
 * catalogue avec sa preuve, et passe le résultat — éventuellement `null`.
 *
 * **Pourquoi ce composant-ci est client.** Deux raisons, et la seconde n'est
 * apparue qu'à l'écran.
 *
 * 1. Effacer le paramètre après le premier rendu. Sans ça, un rechargement, un
 *    favori ou un lien partagé réaffiche « ton compte est créé » indéfiniment :
 *    le code est au passé, il doit donc disparaître une fois lu. C'est le
 *    pendant navigateur de la fenêtre de fraîcheur côté serveur.
 * 2. **Lire le fragment**, que le serveur ne voit jamais. Supabase renvoie les
 *    échecs de liaison derrière un `#` — `#error=server_error&error_code=
 *    identity_already_exists` — et un fragment n'est pas envoyé au serveur. La
 *    route de rappel ne voyait donc aucun `code` et en concluait « annulé »,
 *    quand Discord avait en réalité refusé pour une raison qu'on pouvait dire.
 *
 * **Le fragment l'emporte sur ce que le serveur a deviné**, et c'est le bon
 * sens de priorité : il porte la raison donnée par le fournisseur, là où la
 * route ne peut qu'inférer d'une absence.
 *
 * Le nettoyage a lieu même quand il n'y a rien à afficher : une URL qui traîne
 * un code refusé n'a pas plus de raison d'être gardée.
 *
 * **Toutes les pages qui s'en servent aujourd'hui sont déjà dynamiques** — elles
 * ouvrent une session. Le jour où un message doit apparaître sur une page
 * publique générée statiquement, ce n'est pas ce composant qu'il faut changer :
 * c'est la lecture de `searchParams` qui doit passer côté navigateur
 * (`useSearchParams()` sous `<Suspense>`), sous peine de rendre dynamique toute
 * la page et de défaire son référencement. Une page statique n'a de toute façon
 * aucune preuve à offrir : elle n'a droit qu'aux codes constants.
 */
export function MessageURL({
  message,
  className = '',
}: {
  message: Message | null;
  className?: string;
}) {
  const [duFragment, setDuFragment] = useState<Message | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    let aNettoyer = false;

    if (url.searchParams.has(PARAM)) {
      url.searchParams.delete(PARAM);
      aNettoyer = true;
    }

    if (url.hash.length > 1) {
      const fragment = new URLSearchParams(url.hash.slice(1));
      const duFournisseur = messageFournisseur(fragment.get('error_code'), fragment.get('error'));

      if (duFournisseur) {
        // Un `setState` dans un effet, et il est assumé : le fragment n'existe
        // que dans le navigateur, donc il ne peut pas être lu au rendu sans
        // désaccorder l'hydratation. `useSyncExternalStore` serait l'outil
        // prévu pour ça, mais on efface le fragment juste après — sa relecture
        // rendrait alors une valeur vide et le message disparaîtrait. Le rendu
        // supplémentaire au montage est exactement ce qu'on veut ici.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDuFragment(duFournisseur);
        url.hash = '';
        aNettoyer = true;
      }
    }

    if (!aNettoyer) return;

    // `history.state` est conservé : le routeur de Next y range le sien, et le
    // remplacer par `null` casse la navigation arrière.
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  return <MessageBloc message={duFragment ?? message} className={className} />;
}
