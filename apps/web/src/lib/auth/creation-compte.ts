import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export type ResultatCreation =
  | { readonly ok: true; readonly userId: string }
  | { readonly ok: false; readonly erreur: string; readonly compteExiste: boolean };

/**
 * Créer un compte client et poser sa session, dans la foulée.
 *
 * Deux parcours en ont besoin et doivent se comporter à l'identique : le
 * formulaire de qualification (`/qualification`) et la souscription directe à
 * un abonnement (`/formations/[slug]/souscrire`). Les laisser diverger, c'est
 * s'exposer à ce qu'un compte créé par l'un se comporte autrement que l'autre
 * — sur le consentement RGPD, typiquement, qui est le genre d'écart qu'on ne
 * découvre qu'au moment où on doit le prouver.
 *
 * Trois choses s'y font, dans cet ordre :
 *
 * 1. **Le compte**, sans confirmation d'email. Elle ne bloque pas l'entrée —
 *    ce serait perdre des prospects sur une étape qui ne coûte rien — mais
 *    elle bloque le paiement, vérifié là où l'argent se joue.
 * 2. **Le consentement**, avec la version du texte : sans elle, on ne peut pas
 *    prouver à quoi la personne a consenti le jour où elle le demande.
 * 3. **La session**, posée sans passer par la boîte mail. `generateLink`
 *    fabrique le jeton d'un lien magique sans l'envoyer, `verifyOtp` le
 *    consomme immédiatement côté cookies. La personne enchaîne connectée, ce
 *    qui est le comportement qu'on veut sur les étapes qui produisent du
 *    chiffre d'affaires.
 *
 * Le rôle applicatif `client` et la ligne `profiles` sont posés par le trigger
 * `handle_new_user`, pas ici.
 */
export async function creerCompteEtSession({
  email,
  prenom,
  telephone,
  versionConsentement,
}: {
  email: string;
  prenom: string;
  telephone?: string | null;
  versionConsentement: string;
}): Promise<ResultatCreation> {
  const admin = createServiceRoleClient();

  const { data: compte, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { prenom },
  });

  if (error || !compte.user) {
    const existe = error?.message?.toLowerCase().includes('already') ?? false;

    return {
      ok: false,
      compteExiste: existe,
      erreur: existe
        ? 'Un compte existe déjà avec cette adresse. Connecte-toi pour continuer.'
        : 'La création du compte a échoué. Réessaie dans un instant.',
    };
  }

  const userId = compte.user.id;

  // Le téléphone ne passe pas par les métadonnées d'authentification.
  if (telephone) {
    await admin.from('profiles').update({ telephone }).eq('id', userId);
  }

  await admin.from('consents').insert({
    user_id: userId,
    type: 'confidentialite',
    accorde: true,
    version_texte: versionConsentement,
  });

  const { data: lien } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const jeton = lien?.properties?.hashed_token;

  if (jeton) {
    const avecSession = await createClient();
    await avecSession.auth.verifyOtp({ type: 'magiclink', token_hash: jeton });
  }

  return { ok: true, userId };
}
