import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { destinationApresConnexion } from '@/lib/auth/destination';
import { PARAM } from '@/lib/messages/catalogue';
import { createClient } from '@/lib/supabase/server';

/**
 * `/connexion/confirmer` — là où mène le lien reçu par email.
 *
 * **Deux formes de lien, et la première est celle qu'on veut.**
 *
 * - `?token_hash=…&type=email` : le modèle d'email de Supabase modifié pour
 *   pointer ici (`docs/08-CE-QUI-MANQUE.md`). Le jeton se vérifie sans rien
 *   attendre du navigateur, donc **le lien marche sur n'importe quel appareil**
 *   — l'email lu sur le téléphone, le lien ouvert dans l'application mail.
 * - `?code=…` : le modèle par défaut. Supabase vérifie le lien chez lui puis
 *   renvoie ici un code PKCE, qui ne s'échange **que dans le navigateur qui a
 *   demandé le lien** : le vérificateur est dans ses cookies. Ailleurs, l'échange
 *   échoue. Gardé pour que rien ne casse tant que le modèle n'est pas changé.
 *
 * Les deux vérifient l'adresse au passage : se connecter par un lien envoyé à
 * une adresse prouve qu'on la lit. C'est ce qui débloque le paiement d'un compte
 * créé par le formulaire sans confirmation.
 *
 * **Pas de paramètre de destination.** Une adresse de retour lue dans l'URL est
 * une redirection ouverte qui attend son premier lien piégé ; la destination se
 * déduit des rôles, comme après un mot de passe.
 *
 * Un lien expiré n'arrive souvent même pas ici avec une erreur lisible :
 * Supabase la range dans le fragment (`#error_code=otp_expired`), que le serveur
 * ne voit pas. D'où un seul message d'échec, qui ne prétend pas en connaître la
 * cause.
 */
const TYPES_ACCEPTES: readonly EmailOtpType[] = ['email', 'magiclink', 'signup'];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const code = url.searchParams.get('code');

  const supabase = await createClient();
  let userId: string | undefined;

  if (tokenHash && type && TYPES_ACCEPTES.includes(type)) {
    const { data } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    userId = data.user?.id;
  } else if (code) {
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    userId = data.user?.id;
  }

  if (!userId) {
    const echec = new URL('/connexion', url.origin);
    echec.searchParams.set(PARAM, 'lien-invalide');
    return NextResponse.redirect(echec);
  }

  // Même client que la vérification : la session qu'elle vient de poser est
  // celle sous laquelle la RLS lit les rôles (`user_roles_lit_les_siens`).
  const { data: lignes } = await supabase.from('user_roles').select('role').eq('user_id', userId);

  return NextResponse.redirect(
    new URL(destinationApresConnexion(lignes?.map((l) => l.role) ?? []), url.origin),
  );
}
