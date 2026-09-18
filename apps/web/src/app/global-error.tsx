'use client';

/**
 * Le dernier recours : c'est la mise en page racine elle-même qui a planté.
 *
 * Rien de la mise en page n'est disponible — ni polices, ni feuille de style,
 * ni composants qui en dépendent. D'où un HTML nu aux styles en ligne : il doit
 * s'afficher même quand tout le reste est tombé.
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
          color: '#111827',
          background: '#ffffff',
        }}
      >
        <main style={{ maxWidth: '32rem', margin: '0 auto', padding: '6rem 1.25rem' }}>
          <h1 style={{ fontSize: '1.75rem' }}>Le site est momentanément indisponible</h1>
          <p style={{ lineHeight: 1.6, color: '#4b5563' }}>
            Le problème vient de notre côté. Réessayez dans un instant.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '0.75rem 1.25rem',
              border: 0,
              borderRadius: '0.5rem',
              background: '#111827',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
          {error.digest && (
            <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280' }}>
              Référence : {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
