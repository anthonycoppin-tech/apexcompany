import 'server-only';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { stripe } from '@/lib/stripe';

export type FormationAPayer = {
  id: string;
  titre: string;
  type_produit: string;
  devise: string | null;
};

/**
 * Ouvrir une session de paiement Stripe et déposer la commande en attente.
 *
 * Deux parcours mènent au paiement et doivent produire exactement la même
 * chose en base : la proposition émise après l'audit (accompagnements et
 * formations) et la souscription directe à un abonnement, décidée le
 * 8 septembre 2026. Les écrire deux fois, c'est se garantir que l'un des deux
 * finira par oublier les métadonnées — et sans elles, le webhook ne sait pas
 * qui a payé quoi.
 *
 * Trois points qui ne se négocient pas :
 *
 * - **Le montant vient de l'appelant, jamais du navigateur.** C'est la seule
 *   façon d'être sûr que le prix payé est celui qui a été proposé ou affiché.
 * - **Les métadonnées sont le seul lien entre Stripe et notre base.** Le
 *   webhook n'a rien d'autre pour rattacher l'encaissement à un client et à un
 *   produit.
 * - **La commande est déposée en `en_attente` avant la redirection**, pour
 *   qu'un paiement ouvert laisse une trace même si la personne abandonne sur la
 *   page Stripe. C'est le webhook qui la passera en `payee` — jamais l'écran
 *   qui l'a ouverte, qui ne sait pas si l'argent est arrivé.
 */
export async function ouvrirCheckout({
  userId,
  email,
  formation,
  montantCents,
  propositionId,
  urlSucces,
  urlAnnulation,
}: {
  userId: string;
  email?: string;
  formation: FormationAPayer;
  montantCents: number;
  propositionId?: string;
  urlSucces: string;
  urlAnnulation: string;
}): Promise<{ url: string } | { erreur: string }> {
  const abonnement = formation.type_produit === 'abonnement';
  const devise = (formation.devise ?? 'EUR').toLowerCase();

  try {
    const session = await stripe().checkout.sessions.create({
      mode: abonnement ? 'subscription' : 'payment',
      customer_email: email,
      client_reference_id: userId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: devise,
            unit_amount: montantCents,
            product_data: { name: formation.titre },
            // Le prix récurrent est déclaré à la volée : un abonnement mensuel
            // n'a pas besoin d'un catalogue tenu en double chez Stripe, et un
            // catalogue en double est un catalogue qui diverge.
            ...(abonnement ? { recurring: { interval: 'month' as const } } : {}),
          },
        },
      ],
      metadata: {
        user_id: userId,
        formation_id: formation.id,
        ...(propositionId ? { proposition_id: propositionId } : {}),
      },
      success_url: urlSucces,
      cancel_url: urlAnnulation,
    });

    if (!session.url) {
      return { erreur: 'Le paiement n’a pas pu être ouvert. Réessaie dans un instant.' };
    }

    // Écrit avec la clé de service : la RLS ferme `orders` en écriture à tout
    // le monde sauf au staff, et c'est très bien ainsi — un client qui pourrait
    // insérer ses propres commandes pourrait s'en écrire une payée.
    await createServiceRoleClient()
      .from('orders')
      .insert({
        user_id: userId,
        formation_id: formation.id,
        montant_cents: montantCents,
        devise: (formation.devise ?? 'EUR').toUpperCase(),
        statut: 'en_attente',
        provider: 'stripe',
        provider_order_id: session.id,
      });

    return { url: session.url };
  } catch {
    return { erreur: 'Le paiement n’a pas pu être ouvert. Réessaie dans un instant.' };
  }
}
