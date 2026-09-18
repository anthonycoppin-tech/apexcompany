import Link from 'next/link';

import { Bouton, Conteneur, Surtitre } from '@/components/ui';

export const metadata = { title: 'Page introuvable' };

/**
 * La 404 du site entier — une adresse qui n'existe pas, ou un `notFound()`
 * appelé par une page (fiche produit inconnue, proposition d'un autre client).
 *
 * Sans elle, Next.js affiche sa page anglaise par défaut, sans lien de retour.
 * Posée à la racine et non dans `(public)` : une adresse inconnue n'appartient
 * à aucun groupe de routes, et c'est ce fichier-ci que Next.js sert alors.
 *
 * Elle ne suppose pas qui est là : visiteur, client ou membre de l'équipe
 * tombent tous ici, d'où deux sorties plutôt qu'une.
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center py-24">
      <Conteneur largeur="etroite" className="space-y-6">
        <Link href="/" className="font-titre text-lg font-extrabold tracking-tight">
          Apex<span className="text-accent">Company</span>
        </Link>
        <Surtitre>Erreur 404</Surtitre>
        <h1 className="text-3xl font-extrabold">Cette page n’existe pas</h1>
        <p className="leading-relaxed text-encre-doux">
          L’adresse est peut-être mal saisie, ou la page a été déplacée. Si vous suiviez un lien
          reçu par email, reconnectez-vous : il mène à votre espace.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Bouton href="/">Revenir à l’accueil</Bouton>
          <Bouton href="/connexion" variante="secondaire">
            Accéder à mon espace
          </Bouton>
        </div>
      </Conteneur>
    </main>
  );
}
