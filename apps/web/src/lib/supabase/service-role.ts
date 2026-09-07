import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@apex/db';

/**
 * Client `service_role` — CONTOURNE LA RLS EN ENTIER.
 *
 * `import 'server-only'` fait échouer le build si ce fichier finit importé
 * depuis un composant client : c'est la seule protection à la compilation
 * contre une clé qui, envoyée au navigateur, ouvre tout le schéma.
 *
 * Réservé aux handlers de webhook (stripe, paypal, cal, discord) et au worker
 * du bot Discord — c'est-à-dire les endroits où il n'existe pas de session
 * utilisateur pour porter la RLS. Toute route qui répond à une requête d'un
 * utilisateur connecté doit utiliser lib/supabase/server.ts, pas ceci.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL manquant. ' +
        'Cette clé ne doit jamais être préfixée NEXT_PUBLIC_ et ne vit que côté serveur.',
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
