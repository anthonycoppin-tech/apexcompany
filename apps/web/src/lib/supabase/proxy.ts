import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@apex/db';

/**
 * Rafraîchit le jeton de session à chaque requête et réécrit les cookies sur
 * la réponse. Sans ça, un jeton expiré en cours de navigation déconnecte
 * l'utilisateur au milieu d'une action au lieu qu'il soit renouvelé
 * silencieusement — le comportement documenté par Supabase pour Next.js.
 *
 * Ne fait AUCUN contrôle d'accès par rôle : c'est un rafraîchissement de
 * session, pas une garde. Le contrôle par rôle vit dans les layouts de
 * (espace) et (admin), au plus près des politiques RLS qu'il reflète.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Ne pas retirer : c'est cet appel qui déclenche le rafraîchissement du
  // jeton et l'écriture des nouveaux cookies via setAll ci-dessus.
  await supabase.auth.getUser();

  return response;
}
