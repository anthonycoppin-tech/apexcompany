/**
 * L'accès protégé d'un site d'aperçu — pour que le client consulte le site et y
 * travaille avant l'ouverture, sans qu'il soit public (25 septembre 2026).
 *
 * Activé par `APERCU_ACCES="identifiant:mot-de-passe"`, variable **serveur**
 * posée chez l'hébergeur du site d'aperçu et nulle part ailleurs. Absente, rien
 * ne change : c'est l'état du site de production.
 *
 * Une authentification HTTP « Basic » plutôt qu'un écran à nous : le
 * navigateur demande une fois et retient, elle protège aussi les pages
 * statiques, et elle ne dépend ni de Supabase ni d'un cookie qui pourrait se
 * mêler à la session.
 *
 * Deux choses restent ouvertes, et c'est voulu :
 * - **`/api/`** : les webhooks (Whop, Cal.com, Resend) et les tâches
 *   planifiées ne savent pas répondre à un mot de passe, et chacun a déjà sa
 *   propre vérification — signature ou secret ;
 * - rien d'autre. Un lien de connexion reçu par email demande le mot de passe
 *   dans un navigateur neuf, et c'est le prix à payer pour que rien ne fuie.
 */

export type ReponseApercu =
  { readonly acces: 'libre' } | { readonly acces: 'autorise' } | { readonly acces: 'refuse' };

/** Comparaison à durée constante, pour ne pas révéler le mot de passe caractère par caractère. */
function egal(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return difference === 0;
}

export function verifierApercu(
  identifiants: string | undefined,
  chemin: string,
  entete: string | null,
): ReponseApercu {
  if (!identifiants) return { acces: 'libre' };
  if (chemin.startsWith('/api/')) return { acces: 'libre' };

  const [schema, valeur] = (entete ?? '').split(' ');
  if (schema !== 'Basic' || !valeur) return { acces: 'refuse' };

  let decode = '';
  try {
    decode = atob(valeur);
  } catch {
    return { acces: 'refuse' };
  }

  return egal(decode, identifiants) ? { acces: 'autorise' } : { acces: 'refuse' };
}
