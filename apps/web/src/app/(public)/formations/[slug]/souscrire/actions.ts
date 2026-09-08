'use server';

import { redirect } from 'next/navigation';

import { creerCompteEtSession } from '@/lib/auth/creation-compte';
import { ouvrirCheckout } from '@/lib/paiement/checkout';
import { VERSION_CONSENTEMENT } from '@/lib/qualification/questionnaire';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export type EtatSouscription = { readonly erreur: string | null };

/**
 * Souscrire directement à un abonnement, sans passer par l'audit.
 *
 * Tranché par le chef de projet le 8 septembre 2026. C'est une entorse assumée
 * au « un seul tunnel » de `02-SITEMAP.md`, et elle se justifie : imposer un
 * rendez-vous de vente pour un abonnement mensuel coûterait la majorité des
 * inscriptions. L'audit reste obligatoire pour les accompagnements et les
 * formations, où le panier justifie qu'on vérifie que le produit correspond.
 *
 * **Réservé aux produits de type `abonnement`**, et vérifié ici plutôt que
 * seulement à l'affichage : une action serveur est une API publique, elle ne
 * peut pas faire confiance à l'écran qui l'appelle.
 *
 * Le formulaire est volontairement court — prénom, email, consentement. Le
 * questionnaire de qualification n'a pas lieu d'être : il sert à préparer un
 * audit qui n'aura pas lieu. Le nom de famille se collectera au moment où la
 * facturation l'exige.
 */
export async function souscrire(
  _precedent: EtatSouscription,
  donnees: FormData,
): Promise<EtatSouscription> {
  const lu = (champ: string) => (donnees.get(champ) ?? '').toString().trim();

  const slug = lu('slug');
  if (!slug) return { erreur: 'Produit introuvable.' };

  const supabase = await createClient();

  // Lu sous RLS : `formations_publiques_en_lecture` ne laisse passer que les
  // produits actifs. Un brouillon n'est donc pas souscriptible, sans qu'on ait
  // à l'écrire.
  const { data: formation } = await supabase
    .from('formations')
    .select('id, titre, prix_cents, devise, type_produit')
    .eq('slug', slug)
    .maybeSingle();

  if (!formation) return { erreur: 'Ce produit n’est pas disponible.' };

  if (formation.type_produit !== 'abonnement') {
    return {
      erreur:
        'Ce programme ne se souscrit pas en ligne. Il passe par un échange d’orientation préalable.',
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userId = user?.id;
  let email = user?.email ?? '';
  let emailVerifie = Boolean(user?.email_confirmed_at);

  // ── Visiteur anonyme : on crée le compte avant de facturer ───────────────
  // Le compte doit exister avant le paiement, parce que c'est lui qui permet
  // à la RLS de protéger l'inscription, la facture et l'abonnement qui vont
  // suivre — sans jeton signé à inventer.
  if (!userId) {
    const prenom = lu('prenom');
    email = lu('email').toLowerCase();

    if (!prenom) return { erreur: 'Ton prénom est nécessaire.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { erreur: 'Cette adresse email n’est pas valide.' };
    }
    if (lu('consentement') !== 'on') {
      return { erreur: 'Merci d’accepter la politique de confidentialité pour continuer.' };
    }

    const creation = await creerCompteEtSession({
      email,
      prenom,
      telephone: lu('telephone') || null,
      versionConsentement: VERSION_CONSENTEMENT,
    });

    if (!creation.ok) return { erreur: creation.erreur };

    userId = creation.userId;
    emailVerifie = false;

    // Un souscripteur direct est un client, pas un prospect qualifié : il n'a
    // répondu à aucune question. On garde tout de même une fiche, pour que le
    // CRM ne connaisse pas deux populations dont l'une serait invisible.
    await createServiceRoleClient()
      .from('leads')
      .insert({
        user_id: userId,
        email,
        prenom,
        telephone: lu('telephone') || null,
        source: 'direct',
        statut: 'gagne',
        produit_souhaite_id: formation.id,
        eligible: true,
      });
  }

  // ── L'email doit être vérifié avant de payer ─────────────────────────────
  // Décision consignée en §8 : non bloquant pour prendre rendez-vous, bloquant
  // avant le paiement. Une facture qui part vers une adresse non vérifiée est
  // une facture qu'on ne peut pas prouver avoir envoyée.
  //
  // Le compte vient d'être créé juste au-dessus dans le cas anonyme : la
  // personne est donc renvoyée vers la vérification, pas vers le paiement.
  if (!emailVerifie) {
    redirect(`/formations/${slug}/souscrire?verifier=1`);
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const resultat = await ouvrirCheckout({
    userId,
    email,
    formation,
    montantCents: formation.prix_cents,
    urlSucces: `${site}/espace?paiement=ok`,
    urlAnnulation: `${site}/formations/${slug}/souscrire?paiement=annule`,
  });

  if ('erreur' in resultat) return { erreur: resultat.erreur };

  // Hors de tout try/catch : `redirect` lève une exception pour interrompre le
  // rendu, et un catch la prendrait pour un échec.
  redirect(resultat.url);
}

/**
 * Renvoyer l'email de vérification.
 *
 * Sans cette action, le contrôle bloquant ci-dessus serait une impasse : la
 * personne verrait « vérifie ton email » sans moyen d'en redemander un.
 */
export async function renvoyerVerification(
  precedent: EtatSouscription,
  donnees: FormData,
): Promise<EtatSouscription> {
  // La signature est imposée par `useActionState` : l'état précédent et le
  // FormData sont fournis, cette action-ci n'a besoin ni de l'un ni de l'autre.
  void precedent;
  void donnees;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { erreur: 'Session expirée. Reconnecte-toi pour continuer.' };

  const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });

  if (error) {
    return { erreur: 'L’envoi a échoué. Réessaie dans un instant.' };
  }

  return { erreur: null };
}
