import { RESEAUX, type Reseau } from '@/lib/reseaux';

/**
 * Les comptes de la marque, en icônes.
 *
 * **Monochromes, et c'est un choix.** La règle du projet veut que le bouton
 * « Connecter mon Discord » garde le bleu de la marque, parce qu'on le
 * reconnaît à sa couleur au moment où il faut le trouver. Ici c'est l'inverse :
 * quatre pastilles de couleurs différentes dans un pied de page attirent l'œil
 * plus que le contenu qu'elles accompagnent. Elles héritent donc de
 * `currentColor` et se comportent comme les liens voisins.
 *
 * Chaque lien porte un nom accessible : une icône seule n'a pas de texte, et
 * un lecteur d'écran annoncerait « lien » quatre fois de suite.
 *
 * Les tracés viennent des marques elles-mêmes. Ils sont figés ici plutôt que
 * tirés d'une bibliothèque d'icônes : quatre chemins ne valent pas une
 * dépendance de plus, ni les cinquante kilo-octets qui vont avec.
 */

const TRACES: Record<Reseau['id'], React.ReactNode> = {
  youtube: (
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.9zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z" />
  ),
  instagram: (
    <>
      {/* Instagram est le seul des quatre dessiné au trait : sa marque est un
          contour, la remplir en ferait un carré plein méconnaissable. */}
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.6" cy="6.4" r="1.4" />
    </>
  ),
  tiktok: (
    <path d="M16.6 5.8a4.8 4.8 0 0 1-2.9-2.6V2.5h-3.3v13.2a2.8 2.8 0 1 1-2-2.7V9.6a6.1 6.1 0 1 0 5.3 6v-6.8a8 8 0 0 0 4.7 1.5V6.9a4.8 4.8 0 0 1-1.8-1.1z" />
  ),
  discord: (
    <path d="M19.5 5.3A17.6 17.6 0 0 0 15.2 4l-.3.5a16 16 0 0 0-4.9 0L9.7 4a17.6 17.6 0 0 0-4.3 1.3C2.6 9.4 1.8 13.5 2.2 17.5a17.7 17.7 0 0 0 5.3 2.7l.7-1.1c-.6-.2-1.1-.5-1.6-.8l.4-.3a12.6 12.6 0 0 0 10.6 0l.4.3c-.5.3-1.1.6-1.7.8l.8 1.1a17.6 17.6 0 0 0 5.3-2.7c.4-4.6-.8-8.7-2.9-12.2zM8.7 15.1c-1 0-1.9-1-1.9-2.1 0-1.2.8-2.1 1.9-2.1s1.9 1 1.9 2.1c0 1.2-.8 2.1-1.9 2.1zm6.6 0c-1 0-1.9-1-1.9-2.1 0-1.2.8-2.1 1.9-2.1s1.9 1 1.9 2.1c0 1.2-.8 2.1-1.9 2.1z" />
  ),
};

export function Reseaux({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex items-center gap-4 ${className}`}>
      {RESEAUX.map((reseau) => (
        <li key={reseau.id}>
          <a
            href={reseau.url}
            target="_blank"
            // `noopener` n'est pas une formalité : sans lui, la page ouverte
            // peut réécrire celle qu'on vient de quitter.
            rel="noopener noreferrer"
            className="inline-flex text-encre-doux transition-colors hover:text-encre"
          >
            {/* Pas de `stroke` sur le `svg` : appliqué à un tracé déjà plein,
                il l'épaissit d'un pixel et empâte trois marques sur quatre.
                Instagram, qui est un contour, le déclare sur ses formes. */}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              {TRACES[reseau.id]}
            </svg>
            <span className="sr-only">
              {reseau.id === 'discord'
                ? 'Rejoindre le serveur Discord'
                : `Suivre sur ${reseau.nom}`}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
