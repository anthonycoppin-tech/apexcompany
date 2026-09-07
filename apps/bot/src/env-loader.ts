/**
 * Doit être le tout premier import de worker.ts : avec les modules ES, le
 * corps de chaque import s'exécute dans l'ordre où il apparaît la première
 * fois dans le graphe. env.ts lit process.env à l'évaluation de son module
 * (pas dans une fonction) — s'il s'évalue avant que .env soit chargé, toutes
 * les variables lui semblent absentes.
 */
try {
  process.loadEnvFile();
} catch {
  // Pas de .env local : cas normal en production, où les variables sont
  // injectées par la plateforme d'hébergement plutôt que lues d'un fichier.
}
