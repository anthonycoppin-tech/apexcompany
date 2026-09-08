'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { stripe } from '@/lib/stripe';

export type EtatPaiement = { readonly erreur: string | null };

/**
 * Ouvrir le paiement d'une proposition.
 *
 * La proposition est relue par le client à **session** : la RLS garantit qu'on
 * ne peut ouvrir que la sienne, y compris en appelant cette action avec
 * l'identifiant de quelqu'un d'autre. C'est le bénéfice du compte créé tôt —
 * aucun jeton signé à inventer.
 *
 * Le montant vient de la proposition, jamais du navigateur : c'est la seule
 * façon d'être sûr que le prix payé est celui qui a été proposé.
 *
 * La commande est créée en `en_attente` avant la redirection, pour que
 * l'ouverture d'un paiement laisse une trace même si le client abandonne sur la
 * page Stripe. C'est le webhook qui la passera en `payee` — jamais cet écran,
 * qui ne sait pas si l'argent est arrivé.
 */
export async function ouvrirPaiement(
  _precedent: EtatPaiement,
  donnees: FormData,
): Promise<EtatPaiement> {
  const propositionId = (donnees.get('proposition_id') ?? '').toString();
  if (!propositionId) return { erreur: 'Proposition introuvable.' };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { erreur: 'Session expirée. Reconnecte-toi pour continuer.' };

  const { data: proposition } = await supabase
    .from('propositions')
    .select(
      'id, statut, montant_cents, devise, expire_le, formation_id, formations(titre, type_produit)',
    )
    .eq('id', propositionId)
    .maybeSingle();

  if (!proposition || !proposition.formations) {
    return { erreur: 'Cette proposition n’existe pas ou ne t’est pas destinée.' };
  }

  if (proposition.statut !== 'envoyee') {
    return {
      erreur: 'Cette proposition n’est plus valable. Ton formateur peut en émettre une nouvelle.',
    };
  }

  if (proposition.expire_le && new Date(proposition.expire_le) < new Date()) {
    return { erreur: 'Cette proposition a expiré. Ton formateur peut en émettre une nouvelle.' };
  }

  const abonnement = proposition.formations.type_produit === 'abonnement';
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  let url: string | null = null;

  try {
    const session = await stripe().checkout.sessions.create({
      mode: abonnement ? 'subscription' : 'payment',
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (proposition.devise ?? 'EUR').toLowerCase(),
            unit_amount: proposition.montant_cents,
            product_data: { name: proposition.formations.titre },
            // Le prix récurrent est déclaré à la volée : un abonnement mensuel
            // n'a pas besoin d'un catalogue tenu en double chez Stripe, et un
            // catalogue en double est un catalogue qui diverge.
            ...(abonnement ? { recurring: { interval: 'month' as const } } : {}),
          },
        },
      ],
      // Ces métadonnées sont le seul lien entre la session Stripe et notre
      // base. Le webhook n'a rien d'autre pour savoir qui a payé quoi.
      metadata: {
        proposition_id: proposition.id,
        user_id: user.id,
        formation_id: proposition.formation_id,
      },
      success_url: `${site}/espace?paiement=ok`,
      cancel_url: `${site}/espace/propositions/${proposition.id}?paiement=annule`,
    });

    url = session.url;

    // Écrit avec la clé de service : la RLS ferme `orders` en écriture à tout
    // le monde sauf au staff, et c'est très bien ainsi — un client qui pourrait
    // insérer ses propres commandes pourrait s'en écrire une payée.
    await createServiceRoleClient()
      .from('orders')
      .insert({
        user_id: user.id,
        formation_id: proposition.formation_id,
        montant_cents: proposition.montant_cents,
        devise: proposition.devise ?? 'EUR',
        statut: 'en_attente',
        provider: 'stripe',
        provider_order_id: session.id,
      });
  } catch {
    return { erreur: 'Le paiement n’a pas pu être ouvert. Réessaie dans un instant.' };
  }

  if (!url) return { erreur: 'Le paiement n’a pas pu être ouvert. Réessaie dans un instant.' };

  // Hors du try : `redirect` lève une exception pour interrompre le rendu, et
  // un catch la prendrait pour un échec.
  redirect(url);
}
