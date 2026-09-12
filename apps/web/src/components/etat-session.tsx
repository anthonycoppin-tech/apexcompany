'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { type AppRole } from '@apex/db';

import { BoutonDeconnexion } from '@/components/bouton-deconnexion';
import { destinationApresConnexion } from '@/lib/auth/destination';
import { createClient } from '@/lib/supabase/client';

/**
 * Ce que montre le header du site public selon qu'on est connecté ou non.
 *
 * **Côté client, et c'est un choix.** Le layout public est un composant
 * serveur : y lire la session appellerait `cookies()`, ce qui rendrait
 * dynamiques *toutes* les pages publiques et défferait en silence la
 * génération statique du site — celle-là même sur laquelle repose le travail
 * de référencement (`sitemap.xml`, fiches produit). Le header est de
 * l'habillage, pas du contenu indexable : le lire dans le navigateur ne coûte
 * rien au référencement et garde les pages statiques.
 *
 * La contrepartie assumée : au tout premier rendu, on ne sait pas encore. On
 * n'affiche donc rien à cet emplacement plutôt qu'un « Se connecter » qui
 * sauterait une demi-seconde plus tard — c'est exactement le clignotement qui
 * fait croire qu'on est déconnecté.
 */
export function EtatSession() {
  const [roles, setRoles] = useState<AppRole[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let vivant = true;

    async function lireRoles(userId: string | undefined) {
      if (!userId) {
        if (vivant) setRoles([]);
        return;
      }

      const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
      if (vivant) setRoles(data?.map((l) => l.role) ?? []);
    }

    supabase.auth.getUser().then(({ data }) => lireRoles(data.user?.id));

    // Se connecter ou se déconnecter dans un autre onglet doit se voir ici
    // aussi : sans cet abonnement, le header reste figé sur l'état d'avant.
    const { data: abonnement } = supabase.auth.onAuthStateChange((_evenement, session) => {
      lireRoles(session?.user?.id);
    });

    return () => {
      vivant = false;
      abonnement.subscription.unsubscribe();
    };
  }, []);

  // Premier rendu : l'état n'est pas encore connu.
  if (roles === null) return <div className="h-5 w-px" aria-hidden />;

  if (roles.length === 0) {
    return (
      <Link href="/connexion" className="hidden text-sm text-encre-doux hover:text-encre sm:block">
        Se connecter
      </Link>
    );
  }

  // Le libellé nomme la destination réelle du compte — « Mon espace » sur un
  // compte admin mènerait à `/admin`, ce qui se lit comme une erreur.
  const destination = destinationApresConnexion(roles);
  const libelle =
    destination === '/admin'
      ? 'Back-office'
      : destination === '/formateur'
        ? 'Espace formateur'
        : 'Mon espace';

  return (
    <div className="hidden items-center gap-4 sm:flex">
      <Link href={destination} className="text-sm font-medium text-accent hover:text-accent-fort">
        {libelle}
      </Link>
      <BoutonDeconnexion />
    </div>
  );
}
