import { type AppRole } from '@apex/db';

/**
 * Où mène une connexion réussie, selon les rôles du compte.
 *
 * Ce fichier n'importe **rien** du serveur — ni `next/navigation`, ni le client
 * Supabase de `server.ts` — pour qu'une page cliente comme `/connexion` puisse
 * s'en servir sans tirer du code serveur dans son bundle. C'est la seule raison
 * pour laquelle il ne vit pas dans `roles.ts`.
 *
 * L'ordre n'est pas cosmétique, il suit la garde la plus étroite : un compte
 * `owner` n'a pas le rôle `client` (le seed le retire explicitement), donc
 * l'envoyer vers `/espace` le ferait rebondir vers `/` par la garde de layout —
 * et il se croirait déconnecté, l'écran public affichant « Se connecter ». Cette
 * fonction existe précisément pour que ce rebond ne puisse plus arriver.
 */
export function destinationApresConnexion(roles: readonly AppRole[]): string {
  if (roles.includes('admin') || roles.includes('owner')) return '/admin';
  if (roles.includes('formateur')) return '/formateur';
  if (roles.includes('client')) return '/espace';

  // Un compte sans aucun rôle ne devrait pas exister — le trigger
  // `handle_new_user()` en accorde un à la création. Si ça arrive, le site
  // public est le seul endroit qui ne rejettera pas la personne.
  return '/';
}
