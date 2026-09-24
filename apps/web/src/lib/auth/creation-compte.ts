import 'server-only';

import { ipDeLaRequete } from '@/lib/auth/ip-demande';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Au-delà, on refuse. Assez haut pour qu'une connexion partagée — un bureau,
 * et surtout un opérateur mobile, qui place des milliers d'abonnés derrière une
 * même adresse — ne bloque jamais un vrai prospect au lendemain d'une
 * publication ; assez bas pour qu'un robot ne remplisse pas le CRM et la table
 * des comptes en une nuit.
 *
 * **En développement, toutes les requêtes viennent de `::1`** : vingt comptes
 * de test dans l'heure, et le vingt et unième est refusé. C'est la limite qui
 * marche, pas un bug.
 */
const COMPTES_PAR_HEURE_ET_ADRESSE = 20;

async function comptesRecentsDepuis(
  admin: ReturnType<typeof createServiceRoleClient>,
  ip: string,
): Promise<number> {
  const { count } = await admin
    .from('consents')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  return count ?? 0;
}

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
 *    prouver à quoi la personne a consenti le jour où elle le demande. Et avec
 *    l'adresse d'origine, qui dit d'où — `null` si elle n'est pas connaissable,
 *    jamais une valeur de repli (`ip-demande.ts`).
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
  const ip = await ipDeLaRequete();

  // Une limite par adresse, lue dans les consentements déjà enregistrés : rien
  // de nouveau n'est collecté pour la tenir. Sans adresse connaissable, pas de
  // limite — on ne refuse pas quelqu'un sur une information qu'on n'a pas.
  if (ip && (await comptesRecentsDepuis(admin, ip)) >= COMPTES_PAR_HEURE_ET_ADRESSE) {
    return {
      ok: false,
      compteExiste: false,
      erreur:
        'Trop de comptes ont été créés depuis votre connexion récemment. Réessayez dans une heure, ou écrivez-nous.',
    };
  }

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
        ? 'Un compte existe déjà avec cette adresse. Connectez-vous pour continuer.'
        : 'La création du compte a échoué. Réessayez dans un instant.',
    };
  }

  const userId = compte.user.id;

  // Le téléphone ne passe pas par les métadonnées d'authentification.
  if (telephone) {
    await admin.from('profiles').update({ telephone }).eq('id', userId);
  }

  // **L'email, même si `user_id` est là.** Une preuve de consentement doit
  // survivre à la suppression du compte : `user_id` passe alors à NULL, et
  // sans email la ligne n'a plus aucun identifiant — ce qui faisait échouer la
  // suppression elle-même (migration du 24 septembre 2026).
  await admin.from('consents').insert({
    user_id: userId,
    email,
    type: 'confidentialite',
    accorde: true,
    version_texte: versionConsentement,
    ip,
  });

  const { data: lien } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const jeton = lien?.properties?.hashed_token;

  if (jeton) {
    const avecSession = await createClient();
    await avecSession.auth.verifyOtp({ type: 'magiclink', token_hash: jeton });
  }

  return { ok: true, userId };
}
