import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@apex/db';

/**
 * Client navigateur. Authentifié avec la clé `anon` : tout ce qu'il voit passe
 * par la RLS. Un nouveau client par appel — createBrowserClient est peu coûteux
 * et réutilise la même session sous le capot via les cookies.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
