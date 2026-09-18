'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

import { lienQualification } from '@/lib/qualification/source';

import { Bouton } from './ui';

// L'adresse ne change pas sans nouveau rendu de la page : rien à écouter.
const sAbonnerARien = () => () => {};

type Variante = Parameters<typeof Bouton>[0]['variante'];

/**
 * « Faire le point », qui transmet au formulaire le réseau d'origine lu dans
 * l'adresse de la page courante (`lib/qualification/source.ts`).
 *
 * L'adresse est lue dans le navigateur : un `searchParams` côté serveur
 * rendrait dynamiques toutes les pages publiques, dont l'accueil, et déferait
 * leur génération statique. Le rendu serveur pointe donc vers `/qualification`
 * sans source, et le lien se complète à l'hydratation.
 */
export function BoutonQualification({
  children,
  variante,
  className,
}: {
  children: ReactNode;
  variante?: Variante;
  className?: string;
}) {
  const href = useSyncExternalStore(
    sAbonnerARien,
    () => lienQualification(window.location.search),
    () => '/qualification',
  );

  return (
    <Bouton href={href} variante={variante} className={className}>
      {children}
    </Bouton>
  );
}
