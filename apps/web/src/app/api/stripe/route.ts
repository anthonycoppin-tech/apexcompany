import type Stripe from 'stripe';

import { NextResponse } from 'next/server';

import { stripe } from '@/lib/stripe';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Webhook Stripe — le chemin de l'argent.
 *
 * Ce handler ne fait presque rien lui-même : il vérifie la signature, extrait
 * ce dont il a besoin, et appelle **une** fonction SQL. Tout le traitement
 * métier — insertion dans `payment_events`, commande, encaissement,
 * inscription, facture, rôle Discord, proposition, prospect — se fait dans une
 * seule transaction côté base.
 *
 * C'est la seule façon de tenir la règle de `CLAUDE.md` : « les webhooks
 * insèrent d'abord dans `payment_events`, dans la même transaction que le
 * traitement métier ». Enchaîner les appels depuis ici les mettrait chacun dans
 * sa propre transaction, et une coupure au milieu laisserait l'événement marqué
 * traité avec un client sans accès — l'échec le plus coûteux du système, et le
 * plus difficile à repérer puisque tout paraît normal des deux côtés.
 *
 * L'idempotence n'est pas une précaution : Stripe rejoue ses événements dès que
 * notre réponse tarde. C'est le fonctionnement normal.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ erreur: 'Webhook non configuré' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ erreur: 'Signature absente' }, { status: 401 });
  }

  // Le corps brut : la signature porte sur les octets reçus.
  const corps = await request.text();

  let evenement: Stripe.Event;
  try {
    evenement = stripe().webhooks.constructEvent(corps, signature, secret);
  } catch {
    return NextResponse.json({ erreur: 'Signature invalide' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  try {
    switch (evenement.type) {
      // ── Premier paiement : achat unique ou souscription d'un abonnement ──
      case 'checkout.session.completed': {
        const session = evenement.data.object;
        const meta = session.metadata ?? {};

        if (!meta.user_id || !meta.formation_id) {
          // Sans métadonnées, impossible de savoir qui a payé quoi. On
          // acquitte pour que Stripe cesse de rejouer, et on laisse une trace
          // à traiter à la main : rejouer indéfiniment ne créera pas
          // l'information manquante.
          await supabase.from('automation_logs').insert({
            declencheur: 'stripe.webhook',
            entite_type: 'orders',
            statut: 'ignore',
            details: { event: evenement.id, raison: 'Métadonnées absentes' },
          });
          return NextResponse.json({ recu: true });
        }

        const { data, error } = await supabase.rpc('traiter_paiement', {
          p_provider: 'stripe',
          p_event_id: evenement.id,
          p_event_type: evenement.type,
          p_payload: JSON.parse(corps),
          p_user_id: meta.user_id,
          p_formation_id: meta.formation_id,
          p_montant_cents: session.amount_total ?? 0,
          p_devise: (session.currency ?? 'eur').toUpperCase(),
          p_provider_order_id: session.id,
          p_provider_payment_id:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : (session.payment_intent?.id ?? session.id),
          // `undefined` et non `null` : ces deux paramètres ont une valeur par
          // défaut côté SQL, et les types générés les déclarent optionnels.
          p_proposition_id: meta.proposition_id ?? undefined,
          p_subscription_id:
            typeof session.subscription === 'string'
              ? session.subscription
              : (session.subscription?.id ?? undefined),
        });

        if (error) throw error;
        return NextResponse.json({ recu: true, resultat: data });
      }

      // ── Renouvellement mensuel d'un abonnement ──────────────────────────
      case 'invoice.paid': {
        const facture = evenement.data.object as Stripe.Invoice & {
          subscription?: string | { id: string } | null;
          billing_reason?: string | null;
        };

        // La première facture d'un abonnement est déjà traitée par
        // `checkout.session.completed`. La compter ici offrirait un mois de
        // plus à chaque souscription.
        if (facture.billing_reason !== 'subscription_cycle') {
          return NextResponse.json({ recu: true, ignore: 'premier prélèvement' });
        }

        const abonnement =
          typeof facture.subscription === 'string'
            ? facture.subscription
            : (facture.subscription?.id ?? null);

        if (!abonnement) return NextResponse.json({ recu: true });

        const { data, error } = await supabase.rpc('renouveler_abonnement', {
          p_provider: 'stripe',
          p_event_id: evenement.id,
          p_event_type: evenement.type,
          p_payload: JSON.parse(corps),
          p_subscription_id: abonnement,
          p_montant_cents: facture.amount_paid ?? null,
          p_provider_payment_id: facture.id ?? null,
        });

        if (error) throw error;
        return NextResponse.json({ recu: true, resultat: data });
      }

      // ── Échec de prélèvement ────────────────────────────────────────────
      // On marque, on ne coupe pas. Le délai de grâce avant révocation n'est
      // pas arbitré (§8.7), et couper un accès sur un premier échec — carte
      // expirée, plafond atteint — se paie en résiliations.
      case 'invoice.payment_failed': {
        const facture = evenement.data.object as Stripe.Invoice & {
          subscription?: string | { id: string } | null;
        };
        const abonnement =
          typeof facture.subscription === 'string'
            ? facture.subscription
            : (facture.subscription?.id ?? null);

        if (abonnement) {
          await supabase
            .from('subscriptions')
            .update({ statut: 'impayee' })
            .eq('provider', 'stripe')
            .eq('provider_subscription_id', abonnement);
        }

        return NextResponse.json({ recu: true });
      }

      // ── Résiliation ─────────────────────────────────────────────────────
      // À effet différé : l'accès court jusqu'à la fin de la période déjà
      // payée, et la révocation quotidienne s'en charge le moment venu.
      // Couper tout de suite reviendrait à ne pas rendre le mois encaissé.
      case 'customer.subscription.deleted': {
        const abonnement = evenement.data.object;

        await supabase
          .from('subscriptions')
          .update({ statut: 'resiliee', resiliation_demandee_le: new Date().toISOString() })
          .eq('provider', 'stripe')
          .eq('provider_subscription_id', abonnement.id);

        return NextResponse.json({ recu: true });
      }

      default:
        // Stripe envoie bien plus d'événements qu'on n'en traite. Acquitter les
        // autres évite qu'ils s'accumulent en échec dans son tableau de bord.
        return NextResponse.json({ recu: true, ignore: evenement.type });
    }
  } catch (erreur) {
    await supabase.from('automation_logs').insert({
      declencheur: 'stripe.webhook',
      entite_type: 'payment_events',
      statut: 'echec',
      details: {
        event: evenement.id,
        type: evenement.type,
        erreur: erreur instanceof Error ? erreur.message : String(erreur),
      },
    });

    // 500 volontaire : Stripe rejouera, et l'idempotence rend le rejeu sans
    // danger. Répondre 200 sur un échec ferait disparaître le paiement.
    return NextResponse.json({ erreur: 'Traitement impossible' }, { status: 500 });
  }
}
