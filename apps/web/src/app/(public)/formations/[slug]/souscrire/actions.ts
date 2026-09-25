'use server';

import { redirect } from 'next/navigation';

import { creerCompteEtSession } from '@/lib/auth/creation-compte';
import { acceptationManquante } from '@/lib/legal/acceptation';
import { lireAccesExistant } from '@/lib/paiement/acces-existant';
import { ouvrirCheckout } from '@/lib/paiement/checkout';
import { VERSION_CONSENTEMENT } from '@/lib/qualification/questionnaire';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';

/**
 * Acheter directement un produit du catalogue, sans passer par l'audit.
 *
 * Tranché pour l'abonnement le 8 septembre 2026, **étendu à tout le catalogue
 * le 25 septembre** à la demande du client, après la présentation : formations
 * et accompagnements se vendent aussi au prix affiché, sans rendez-vous.
 * L'audit reste proposé — il mène à une proposition, seul chemin vers un prix
 * différent du catalogue. Ici, le prix est toujours celui du catalogue, relu en
 * base : une action serveur est une API publique.
 *
 * Le formulaire est volontairement court — prénom, email, consentement. Le
 * questionnaire de qualification n'a pas lieu d'être : il sert à préparer un
 * audit qui n'aura pas lieu. Le nom de famille se collectera au moment où la
 * facturation l'exige.
 */
export async function souscrire(_precedent: EtatAction, donnees: FormData): Promise<EtatAction> {
  const lu = (champ: string) => (donnees.get(champ) ?? '').toString().trim();

  const slug = lu('slug');
  if (!slug) return echoue('Produit introuvable.');

  const supabase = await createClient();

  // `actif` est filtré explicitement, et c'est **le filtre qui coûte le plus
  // cher à oublier de tout le dépôt.**
  //
  // Le commentaire qui tenait ici affirmait que la RLS suffisait. C'est faux :
  // les politiques d'une même commande se combinent en OU, et
  // `formations_interne_lit_tout` laisse le staff lire les brouillons. Un
  // membre de l'équipe connecté pouvait donc ouvrir un vrai abonnement Stripe
  // sur un produit qui n'est pas en vente — encaissement réel, inscription
  // réelle, et un produit dont le rôle Discord n'est peut-être même pas créé
  // puisque rien n'oblige un brouillon à en déclarer un.
  const { data: formation } = await supabase
    .from('formations')
    .select('id, titre, prix_cents, devise, type_produit, duree_acces_jours')
    .eq('slug', slug)
    .eq('actif', true)
    .maybeSingle();

  if (!formation) return echoue('Ce produit n’est pas disponible.');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userId = user?.id;
  let email = user?.email ?? '';
  let emailVerifie = Boolean(user?.email_confirmed_at);

  // Un compte qui vient d'être créé ne peut rien détenir : la vérification ne
  // vaut que pour une session existante.
  if (user) {
    const acces = await lireAccesExistant(supabase, user.id, formation);
    if (acces.bloque) return echoue(acces.raison);
  }

  // ── Visiteur anonyme : on crée le compte avant de facturer ───────────────
  // Le compte doit exister avant le paiement, parce que c'est lui qui permet
  // à la RLS de protéger l'inscription, la facture et l'abonnement qui vont
  // suivre — sans jeton signé à inventer.
  if (!userId) {
    const prenom = lu('prenom');
    email = lu('email').toLowerCase();

    if (!prenom) return echoue('Votre prénom est nécessaire.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return echoue('Cette adresse email n’est pas valide.');
    }
    if (lu('consentement') !== 'on') {
      return echoue('Merci d’accepter la politique de confidentialité pour continuer.');
    }

    const creation = await creerCompteEtSession({
      email,
      prenom,
      telephone: lu('telephone') || null,
      versionConsentement: VERSION_CONSENTEMENT,
    });

    if (!creation.ok) return echoue(creation.erreur);

    userId = creation.userId;
    emailVerifie = false;

    // Un acheteur direct n'a répondu à aucune question. On garde tout de même
    // une fiche, pour que le CRM ne connaisse pas deux populations dont l'une
    // serait invisible — et parce qu'une proposition part toujours d'une fiche.
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
  // Sans paramètre : l'écran de vérification se déduit de `email_confirmed_at`,
  // que la page relit. Le `?verifier=1` d'avant était la moitié forgeable d'une
  // condition dont l'autre moitié était déjà vraie — il n'y avait rien à
  // remplacer, seulement à enlever.
  if (!emailVerifie) {
    redirect(`/formations/${slug}/souscrire`);
  }

  // Les deux cases des CGV et du démarrage immédiat. Vérifiées ici, au dernier
  // moment, parce que c'est ce paiement-là qu'elles autorisent ; enregistrées
  // par `ouvrirCheckout`.
  const manque = acceptationManquante(donnees);
  if (manque) return echoue(manque);

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const resultat = await ouvrirCheckout({
    userId,
    email,
    formation,
    montantCents: formation.prix_cents,
    urlSucces: `${site}/espace?m=paiement-recu`,
  });

  if ('erreur' in resultat) return echoue(resultat.erreur);

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
  precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  // La signature est imposée par `useActionState` : l'état précédent et le
  // FormData sont fournis, cette action-ci n'a besoin ni de l'un ni de l'autre.
  void precedent;
  void donnees;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return echoue('Session expirée. Reconnectez-vous pour continuer.');

  const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });

  if (error) {
    return echoue('L’envoi a échoué. Réessayez dans un instant.');
  }

  return reussi('Email renvoyé. Vérifiez votre boîte de réception.');
}
