'use client';

import Link from 'next/link';

import { BoutonAction, Conteneur, Surtitre } from '@/components/ui';

/**
 * Une page qui plante, n'importe où sous la racine.
 *
 * Sans elle, un échec de rendu — la base qui ne répond pas, typiquement —
 * laisse un écran blanc, et la personne ne sait ni si c'est de son fait, ni
 * s'il faut réessayer.
 *
 * **Le message d'erreur ne s'affiche jamais** : il peut parler de la base, d'une
 * clé, d'une requête. Seule la référence (`digest`) est montrée, parce que
 * c'est elle qui permet de retrouver l'erreur dans les journaux de l'hébergeur
 * quand quelqu'un écrit pour la signaler.
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center py-24">
      <Conteneur largeur="etroite" className="space-y-6">
        <Link href="/" className="font-titre text-lg font-extrabold tracking-tight">
          Apex<span className="text-accent">Company</span>
        </Link>
        <Surtitre>Erreur</Surtitre>
        <h1 className="text-3xl font-extrabold">Cette page n’a pas pu s’afficher</h1>
        <p className="leading-relaxed text-encre-doux">
          Le problème vient de notre côté, pas du vôtre. Réessayez dans un instant ; s’il persiste,
          écrivez-nous en indiquant la référence ci-dessous.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <BoutonAction type="button" onClick={reset}>
            Réessayer
          </BoutonAction>
          <Link href="/" className="text-sm text-encre-doux underline hover:text-encre">
            Revenir à l’accueil
          </Link>
        </div>
        {error.digest && (
          <p className="font-mono text-xs text-encre-faible">Référence : {error.digest}</p>
        )}
      </Conteneur>
    </main>
  );
}
