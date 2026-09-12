'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * Se déconnecter — depuis le site public comme depuis les espaces connectés.
 *
 * Un composant à part parce qu'il est le seul de la famille dont les espaces
 * connectés ont besoin : leur header nomme déjà la zone où l'on se trouve, un
 * lien vers cette même zone y serait un lien vers soi-même.
 */
export function BoutonDeconnexion({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);

  async function deconnecter() {
    setEnCours(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    // `refresh()` en plus de la navigation : les pages rendues côté serveur
    // garderaient sinon en cache un affichage calculé avec la session d'avant.
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={deconnecter}
      disabled={enCours}
      className={`text-sm text-encre-doux transition-colors hover:text-encre disabled:opacity-50 ${className}`}
    >
      {enCours ? 'Déconnexion…' : 'Se déconnecter'}
    </button>
  );
}
