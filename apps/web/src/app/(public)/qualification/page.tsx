import { Conteneur } from '@/components/ui';

import { FormulaireQualification } from './formulaire';

export const metadata = {
  title: 'Audit stratégique — 2 minutes pour faire le point',
  description: 'Quelques questions sur ta situation, puis le créneau de ton audit stratégique.',
};

/**
 * `/qualification` — la porte d'entrée du tunnel.
 *
 * Tout passe par ici : le formulaire crée le compte, attribue le rôle Discord
 * `invité` et ouvre `/reserver`. Les fiches produit servent à convaincre, pas à
 * acheter.
 *
 * `?src=ig|yt|tt|sc` vient du lien unique mis en avant sur les réseaux. Il est
 * capté au premier contact et stocké sur le lead, où il ne sera plus jamais
 * réécrit — c'est la réponse au besoin du pôle branding, savoir quel réseau
 * convertit réellement.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ src?: string }> }) {
  const { src } = await searchParams;

  return (
    <Conteneur largeur="etroite" className="py-16 sm:py-24">
      <FormulaireQualification src={src} />
    </Conteneur>
  );
}
