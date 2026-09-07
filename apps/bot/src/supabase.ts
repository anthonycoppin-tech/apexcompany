import { createClient } from '@supabase/supabase-js';

import type { Database } from '@apex/db';

import { env } from './env.js';

/**
 * Client `service_role` : le worker n'a pas de session utilisateur pour
 * porter la RLS, c'est précisément pour ça qu'il existe (CLAUDE.md, « Discord
 * passe par la file »). Pas de garde `server-only` ici — ce n'est pas du code
 * Next.js, il n'y a pas de bundle client dans lequel fuiter.
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
