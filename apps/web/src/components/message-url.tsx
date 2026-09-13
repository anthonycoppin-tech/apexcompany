'use client';

import { useEffect } from 'react';

import { PARAM } from '@/lib/messages/catalogue';
import type { Message } from '@/lib/messages/types';

import { MessageBloc } from './message';

/**
 * Le bandeau porté par `?m=`, et le nettoyage de l'URL qui va avec.
 *
 * **Pourquoi le message arrive en propriété plutôt que d'être résolu ici.**
 * Les codes dépendants ont besoin d'une preuve lue en base (`preuves.ts`), donc
 * d'un composant serveur. La page lit `searchParams`, appelle la fonction de
 * catalogue avec sa preuve, et passe le résultat — éventuellement `null`.
 *
 * **Pourquoi ce composant-ci est client.** Pour effacer le paramètre après le
 * premier rendu. Sans ça, un rechargement, un favori ou un lien partagé
 * réaffiche « ton compte est créé » indéfiniment : le code est au passé, il
 * doit donc disparaître une fois lu. C'est le pendant navigateur de la fenêtre
 * de fraîcheur côté serveur — ni l'un ni l'autre ne suffit seul, le premier ne
 * protège que celui qui recharge, la seconde ne s'applique qu'au rendu suivant.
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
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PARAM)) return;

    url.searchParams.delete(PARAM);

    // `history.state` est conservé : le routeur de Next y range le sien, et le
    // remplacer par `null` casse la navigation arrière.
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  return <MessageBloc message={message} className={className} />;
}
