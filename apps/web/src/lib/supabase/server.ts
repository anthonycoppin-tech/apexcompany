import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@apex/db';

/**
 * Client serveur, authentifié avec la clé `anon` — donc soumis à la RLS comme
 * n'importe quel visiteur. À utiliser dans les Server Components, Server
 * Actions et Route Handlers pour tout ce qui doit respecter les politiques de
 * l'utilisateur courant.
 *
 * Le `catch` sur `setAll` est documenté par Supabase : un Server Component ne
 * peut pas écrire de cookies (seuls Route Handlers et Server Actions le
 * peuvent). L'échec silencieux est correct ici parce que le rafraîchissement
 * de session a lieu dans proxy.ts, qui s'exécute avant et peut écrire.
 * (Next 16 a renommé `middleware` en `proxy` : chercher middleware.ts ne mène
 * plus nulle part.)
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : sans effet, le middleware
            // s'en charge déjà.
          }
        },
      },
    },
  );
}
