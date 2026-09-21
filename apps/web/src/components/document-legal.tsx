import Link from 'next/link';
import type { ReactNode } from 'react';

import { Conteneur } from '@/components/ui';
import { MISE_A_JOUR_LISIBLE } from '@/lib/legal/societe';

/**
 * La mise en page des textes légaux rédigés.
 *
 * Distincte de `PageLegale`, qui reste la coquille d'une page **pas encore
 * écrite** (l'accessibilité, faute d'audit). Les deux ne doivent pas se
 * confondre : l'une engage la société, l'autre dit qu'elle n'engage encore
 * rien.
 *
 * Les textes viennent de ceux de l'ancien site, relus et remis au
 * fonctionnement réel de celui-ci — `docs/08-CE-QUI-MANQUE.md` dit ce qui a été
 * changé et pourquoi. **Ils n'ont pas été relus par un juriste.**
 */
export function DocumentLegal({
  titre,
  chapeau,
  children,
}: {
  titre: string;
  chapeau?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Conteneur largeur="moyenne" className="space-y-10 py-16 sm:py-24">
      <header className="space-y-4">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{titre}</h1>
        <p className="text-sm text-encre-faible">Dernière mise à jour : {MISE_A_JOUR_LISIBLE}</p>
        {chapeau && <div className="text-lg leading-relaxed text-encre-doux">{chapeau}</div>}
      </header>

      <div className="space-y-10">{children}</div>

      <nav aria-label="Autres documents légaux" className="border-t border-filet pt-6 text-sm">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {DOCUMENTS.map((d) => (
            <li key={d.href}>
              <Link href={d.href} className="text-encre-doux hover:text-encre">
                {d.libelle}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Conteneur>
  );
}

export const DOCUMENTS = [
  { href: '/mentions-legales', libelle: 'Mentions légales' },
  { href: '/cgv', libelle: 'Conditions générales de vente' },
  { href: '/avertissement', libelle: 'Avertissement sur les risques' },
  { href: '/remboursement', libelle: 'Rétractation et remboursement' },
  { href: '/confidentialite', libelle: 'Confidentialité' },
  { href: '/cookies', libelle: 'Cookies' },
] as const;

/** Un article numéroté. L'ancre permet de renvoyer vers une clause précise. */
export function Article({
  id,
  titre,
  children,
}: {
  id?: string;
  titre: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-xl font-bold">{titre}</h2>
      <div className="space-y-3 leading-relaxed text-encre-doux [&_a]:text-accent [&_a]:underline [&_li]:pl-1 [&_strong]:text-encre [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export function SousTitre({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 font-semibold text-encre">{children}</h3>;
}
