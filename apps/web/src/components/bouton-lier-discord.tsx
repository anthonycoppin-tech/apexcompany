'use client';

import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * « Connecter mon Discord » — la seule façon d'obtenir l'identifiant Discord
 * d'un client.
 *
 * `linkIdentity` rattache l'identité Discord au compte DÉJÀ existant, au lieu
 * d'en créer un second. C'est la différence qui compte ici : la personne a un
 * compte depuis le formulaire de qualification, et un `signInWithOAuth` en
 * ferait un doublon avec un email peut-être différent de celui qu'elle a saisi.
 *
 * Le scope demandé est `identify`, et rien d'autre : on a besoin de son
 * identifiant, pas de lire ses serveurs ni ses messages.
 */
export function BoutonLierDiscord({ libelle = 'Connecter mon compte Discord' }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function lier() {
    setEnCours(true);
    setErreur(null);

    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/api/discord/callback`,
        scopes: 'identify',
      },
    });

    if (error) {
      setErreur("La connexion à Discord n'a pas abouti. Réessaie dans un instant.");
      setEnCours(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Aux couleurs de Discord, et pas à celles du site : c'est ce qui rend le
          bouton immédiatement identifiable. Le token vit dans `globals.css`. */}
      <button
        type="button"
        onClick={lier}
        disabled={enCours}
        className="inline-flex items-center justify-center rounded-douce bg-discord px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-discord-fort disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enCours ? 'Redirection…' : libelle}
      </button>
      {erreur && (
        <p role="alert" className="text-sm text-alerte">
          {erreur}
        </p>
      )}
    </div>
  );
}
