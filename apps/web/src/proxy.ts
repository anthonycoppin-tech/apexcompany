import { NextResponse, type NextRequest } from 'next/server';

import { verifierApercu } from '@/lib/apercu';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  // Le site d'aperçu est protégé par un mot de passe, et ne s'indexe jamais
  // (`lib/apercu.ts`). En production, la variable est absente et rien ne change.
  const identifiants = process.env.APERCU_ACCES;
  const apercu = verifierApercu(
    identifiants,
    request.nextUrl.pathname,
    request.headers.get('authorization'),
  );

  if (apercu.acces === 'refuse') {
    return new NextResponse('Site en préparation — accès réservé.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Apercu ApexCompany", charset="UTF-8"',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  const response = await updateSession(request);
  if (identifiants) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf les assets statiques et l'optimiseur d'images,
     * qui n'ont jamais besoin de session.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
