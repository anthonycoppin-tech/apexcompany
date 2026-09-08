import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Les quelques primitives partagées du site public.
 *
 * Volontairement peu nombreuses. Une charte est en cours : multiplier les
 * composants maintenant, c'est multiplier ce qu'il faudra reprendre. Ce qui
 * compte ici, c'est qu'aucune page ne pose de couleur littérale — tout passe
 * par les tokens de `globals.css`.
 */

export function Conteneur({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-6xl px-5 ${className}`}>{children}</div>;
}

export function Section({
  children,
  fond = 'clair',
  className = '',
}: {
  children: ReactNode;
  fond?: 'clair' | 'surface' | 'nuit';
  className?: string;
}) {
  const fonds = {
    clair: 'bg-fond',
    surface: 'bg-surface',
    nuit: 'bg-nuit text-white',
  } as const;

  return (
    <section className={`${fonds[fond]} py-16 sm:py-24 ${className}`}>
      <Conteneur>{children}</Conteneur>
    </section>
  );
}

/** Petit intitulé au-dessus d'un titre de section. */
export function Surtitre({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">{children}</p>
  );
}

type Variante = 'principal' | 'secondaire' | 'clair';

const variantes: Record<Variante, string> = {
  principal: 'bg-accent text-accent-contraste hover:bg-accent-fort',
  secondaire: 'border border-filet-fort text-encre hover:bg-surface',
  clair: 'bg-white text-encre hover:bg-surface-forte',
};

export function Bouton({
  href,
  children,
  variante = 'principal',
  className = '',
}: {
  href: string;
  children: ReactNode;
  variante?: Variante;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-douce px-5 py-3 text-sm font-semibold transition-colors ${variantes[variante]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Carte({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-carte border border-filet bg-fond p-6 ${className}`}>{children}</div>
  );
}

/**
 * L'avertissement légal, écrit une fois et posé partout où il est question de
 * résultats ou de programmes.
 *
 * Ce n'est pas de la prudence décorative : la formation en investissement est
 * un domaine où une promesse de gain engage. Le site actuel évite déjà
 * soigneusement toute promesse de rendement, et la référence citée affiche le
 * même type de mention. **À faire valider par le client et son conseil** — le
 * texte ci-dessous est une base, pas un avis juridique.
 */
export function AvertissementRisque({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-encre-faible ${className}`}>
      ApexCompany dispense de la formation. Aucun programme ne constitue un conseil en
      investissement, une recommandation personnalisée ni une promesse de résultat. Les marchés
      financiers présentent un risque de perte en capital, et les performances passées ne préjugent
      pas des performances futures.
    </p>
  );
}
