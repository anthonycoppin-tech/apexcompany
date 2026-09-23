'use client';

/**
 * Le dernier recours : c'est la mise en page racine elle-même qui a planté.
 *
 * Rien de la mise en page n'est disponible — ni polices, ni feuille de style,
 * ni composants qui en dépendent. D'où un HTML nu aux styles en ligne : il doit
 * s'afficher même quand tout le reste est tombé.
 *
 * C'est le seul écran du site dont les couleurs sont recopiées à la main au
 * lieu de venir de `globals.css`, et il faut donc penser à le repeindre avec la
 * charte — sans quoi une panne se traduit par un écran blanc éblouissant au
 * milieu d'un site sombre, ce qui fait passer une erreur serveur pour un bug
 * d'affichage. Valeurs reprises de `--color-fond`, `--color-encre`,
 * `--color-encre-doux`, `--color-accent` et `--color-accent-contraste`.
 */
export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          color: '#f4f5ff',
          background: '#080b1c',
        }}
      >
        <main style={{ maxWidth: '32rem', margin: '0 auto', padding: '6rem 1.25rem' }}>
          <h1 style={{ fontSize: '1.75rem' }}>Le site est momentanément indisponible</h1>
          <p style={{ lineHeight: 1.6, color: '#b0b6dd' }}>
            Le problème vient de notre côté. Réessayez dans un instant.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '0.75rem 1.25rem',
              border: 0,
              borderRadius: '0.5rem',
              background: '#8f7dff',
              color: '#080b1c',
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
          {error.digest && (
            <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#7b82ae' }}>
              Référence : {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
