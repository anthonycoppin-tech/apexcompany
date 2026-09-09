import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Les quelques primitives partagées du site public.
 *
 * Volontairement peu nombreuses. Une charte est en cours : multiplier les
 * composants maintenant, c'est multiplier ce qu'il faudra reprendre. Ce qui
 * compte ici, c'est qu'aucune page ne pose de couleur littérale — tout passe
 * par les tokens de `globals.css`.
 */

type Largeur = 'large' | 'moyenne' | 'etroite';

const largeurs: Record<Largeur, string> = {
  large: 'max-w-6xl', // grilles et listes
  moyenne: 'max-w-3xl', // texte suivi, où la longueur de ligne compte
  etroite: 'max-w-xl', // formulaires
};

/**
 * La largeur passe par une propriété, **jamais par `className`**.
 *
 * Deux utilitaires `max-width` sur le même élément ne se départagent pas par
 * l'ordre des classes écrites ici, mais par leur ordre dans la feuille générée.
 * `max-w-6xl` y est émis après `max-w-3xl` : un appelant qui passait
 * `className="max-w-3xl"` obtenait donc la pleine largeur, en silence, alors que
 * `max-w-md` — émis après — fonctionnait. Cinq pages du site public
 * s'affichaient ainsi trop larges, sans que rien ne le signale.
 */
export function Conteneur({
  children,
  largeur = 'large',
  className = '',
}: {
  children: ReactNode;
  largeur?: Largeur;
  className?: string;
}) {
  return <div className={`mx-auto w-full px-5 ${largeurs[largeur]} ${className}`}>{children}</div>;
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

const classesBouton = (variante: Variante, className: string) =>
  `inline-flex items-center justify-center rounded-douce px-5 py-3 text-sm font-semibold transition-colors ${variantes[variante]} ${className}`;

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
    <Link href={href} className={classesBouton(variante, className)}>
      {children}
    </Link>
  );
}

/**
 * Le même bouton, en `<button>`.
 *
 * Deux composants courts plutôt qu'un seul qui déciderait selon la présence
 * d'un `href` : un formulaire soumet, il ne navigue pas, et confondre les deux
 * finit toujours par produire un lien qui poste ou un bouton qui ne soumet rien.
 */
export function BoutonAction({
  children,
  variante = 'principal',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={`${classesBouton(variante, className)} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

/**
 * L'habillage des champs de saisie, en constante plutôt qu'en composant : les
 * champs varient trop par leurs attributs (`type`, `name`, `value`, contrôlé ou
 * non) pour qu'un emballage y gagne quoi que ce soit.
 *
 * Le contour de focus du navigateur est conservé — seule la bordure change de
 * couleur. Le supprimer rendrait le formulaire impraticable au clavier, et
 * c'est la première chose qu'on casse en habillant un champ.
 */
export const CHAMP =
  'w-full rounded-douce border border-filet-fort bg-fond px-3 py-2 text-sm text-encre transition-colors placeholder:text-encre-faible focus:border-accent';

/**
 * L'habillage d'une liste de lignes — accès, rendez-vous, propositions.
 *
 * Constante et non composant, pour la même raison que `CHAMP` : les listes
 * diffèrent trop par leur contenu. `overflow-hidden` n'est pas décoratif — sans
 * lui, la première et la dernière ligne débordent du rayon de la bordure.
 */
export const LISTE =
  'divide-y divide-filet overflow-hidden rounded-carte border border-filet bg-fond';

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
