'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { type AppRole } from '@apex/db';

import { BoutonDeconnexion } from '@/components/bouton-deconnexion';
import { Bouton } from '@/components/ui';
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
  if (roles === null) return <div className="h-9 w-px" aria-hidden />;

  // Visiteur : l'appel à l'action unique du site, celui de `02-SITEMAP.md`.
  if (roles.length === 0) {
    return (
      <>
        <Link
          href="/connexion"
          className="hidden text-sm text-encre-doux hover:text-encre sm:block"
        >
          Se connecter
        </Link>
        <Bouton href="/qualification" className="px-4 py-2">
          Faire le point
        </Bouton>
      </>
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

  // Connecté : « Faire le point » disparaît. C'est l'entrée du tunnel — elle
  // crée un compte et ouvre une session. Proposée à quelqu'un qui en a déjà
  // une, elle n'a aucun sens pour un client, et pour un membre de l'équipe
  // elle remplit le CRM de prospects fictifs. La place revient à la
  // destination du compte, qui est ce qu'on vient chercher dans ce coin de
  // l'écran.
  return (
    <>
      <BoutonDeconnexion className="hidden sm:block" />
      <Bouton href={destination} className="px-4 py-2">
        {libelle}
      </Bouton>
    </>
  );
}
