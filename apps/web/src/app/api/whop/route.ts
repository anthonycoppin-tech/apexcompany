import { NextResponse } from 'next/server';

import type { Json } from '@apex/db';

import { decisionEncaissement, type PaiementWhop } from '@/lib/paiement/aiguillage-whop';
import { decimalVersCents } from '@/lib/paiement/montants-whop';
import { referencesDuPaiement, statutLitige } from '@/lib/paiement/references-whop';
import { verifierSignature } from '@/lib/paiement/signature-whop';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Webhook Whop — le chemin de l'argent.
 *
 * Ce handler ne fait presque rien lui-même : il vérifie la signature, extrait
 * ce dont il a besoin, et appelle **une** fonction SQL. Tout le traitement
 * métier — insertion dans `payment_events`, commande, encaissement,
 * inscription, facture, rôle Discord, proposition, prospect — se fait dans une
 * seule transaction côté base.
 *
 * C'est la règle de `CLAUDE.md` : « les webhooks insèrent d'abord dans
 * `payment_events`, dans la même transaction que le traitement métier ».
 * Enchaîner les appels depuis ici les mettrait chacun dans sa propre
 * transaction, et une coupure au milieu laisserait l'événement marqué traité
 * avec un client sans accès — l'échec le plus coûteux du système, et le plus
 * difficile à repérer puisque tout paraît normal des deux côtés.
 *
 * **Ce qui change par rapport au webhook Stripe qu'il remplace**, au-delà du
 * nom des événements :
 *
 * - la signature suit « Standard Webhooks » et porte sur `{id}.{horodatage}.
 *   {corps}` (`lib/paiement/signature-whop.ts`), avec une fenêtre de cinq
 *   minutes qui est notre seule protection contre le rejeu ;
 * - **les montants arrivent en décimales**, jamais en centimes
 *   (`lib/paiement/montants-whop.ts`) ;
 * - premier paiement et renouvellement arrivent sous le **même** événement,
 *   `payment.succeeded`. On les distingue par l'état de la base, pas par une
 *   chaîne de caractères. Ce tri est la partie risquée de ce fichier — se
 *   tromper offre un mois à chaque souscription, ou crée une seconde
 *   inscription à quelqu'un qui en a déjà une — alors il vit ailleurs, en
 *   fonction pure : `lib/paiement/aiguillage-whop.ts`, et il est testé ;
 * - un paiement peut arriver **sans métadonnées**, par l'un des seize liens
 *   diffusés avant que le site ne sache ouvrir un paiement. Il part alors dans
 *   la file de rattrapage plutôt que dans un journal que personne ne relit.
 *
 * L'idempotence n'est pas une précaution : Whop rejoue ses événements dès que
 * notre réponse tarde. C'est le fonctionnement normal.
 */

type EvenementWhop = {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ erreur: 'Webhook non configuré' }, { status: 503 });
  }

  // Le corps brut : la signature porte sur les octets reçus, et un aller-retour
  // par `JSON.parse` puis `JSON.stringify` ne les rend pas à l'identique.
  const corps = await request.text();

  const verdict = verifierSignature(
    secret,
    {
      id: request.headers.get('webhook-id'),
      horodatage: request.headers.get('webhook-timestamp'),
      signature: request.headers.get('webhook-signature'),
    },
    corps,
  );

  if (!verdict.valide) {
    return NextResponse.json({ erreur: `Signature refusée (${verdict.raison})` }, { status: 401 });
  }

  let evenement: EvenementWhop;
  try {
    evenement = JSON.parse(corps) as EvenementWhop;
  } catch {
    return NextResponse.json({ erreur: 'Corps illisible' }, { status: 400 });
  }

  // L'identifiant de l'événement est la clé d'idempotence de `payment_events`.
  // Sans lui, on ne peut pas garantir qu'un rejeu ne compte pas deux fois —
  // et il vaut mieux refuser que traiter sans filet.
  const idEvenement = evenement.id ?? request.headers.get('webhook-id');
  if (!idEvenement || !evenement.type) {
    return NextResponse.json({ erreur: 'Événement sans identifiant ni type' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const donnees = (evenement.data ?? {}) as Record<string, unknown>;
  const payload = JSON.parse(corps) as Json;

  try {
    switch (evenement.type) {
      // ── Un encaissement : premier paiement ou renouvellement ─────────────
      case 'payment.succeeded': {
        const paiement = donnees as PaiementWhop;
        const adhesion = typeof paiement.membership_id === 'string' ? paiement.membership_id : null;

        // Le tri lui-même est une fonction pure, éprouvée dans
        // `aiguillage-whop.test.ts`. Elle a besoin d'une seule chose que le
        // code ne peut pas déduire de l'événement : cette adhésion est-elle
        // déjà connue ? On la lui donne, elle rend une décision.
        const decision = decisionEncaissement(paiement, {
          adhesionConnue: adhesion !== null && (await estUnRenouvellement(supabase, adhesion)),
        });

        if (decision.type === 'rattrapage') {
          await rattraper(supabase, idEvenement, paiement, decision.raison);
          return NextResponse.json({ recu: true, rattrapage: true });
        }

        if (decision.type === 'renouvellement') {
          const { data, error } = await supabase.rpc('renouveler_abonnement', {
            p_provider: 'whop',
            p_event_id: idEvenement,
            p_event_type: evenement.type,
            p_payload: payload,
            p_subscription_id: decision.adhesion,
            p_montant_cents: decision.montantCents,
            p_provider_payment_id: decision.referencePaiement || undefined,
            // `undefined` et non `null` : ces paramètres ont une valeur par
            // défaut côté SQL, et les types générés les déclarent optionnels.
            p_tva_cents: decision.tvaCents ?? undefined,
            p_pays_client: decision.paysClient ?? undefined,
          });

          if (error) throw error;
          return NextResponse.json({ recu: true, resultat: data });
        }

        const { data, error } = await supabase.rpc('traiter_paiement', {
          p_provider: 'whop',
          p_event_id: idEvenement,
          p_event_type: evenement.type,
          p_payload: payload,
          p_user_id: decision.userId,
          p_formation_id: decision.formationId,
          p_montant_cents: decision.montantCents,
          p_devise: decision.devise,
          // Notre propre référence, posée avant l'appel à Whop et rendue par
          // les métadonnées : c'est elle qui retrouve la commande déposée en
          // `en_attente`. Voir `ouvrirCheckout()` pour le raisonnement.
          p_provider_order_id: decision.commande,
          p_provider_payment_id: decision.referencePaiement,
          p_proposition_id: decision.propositionId ?? undefined,
          p_subscription_id: decision.adhesion ?? undefined,
          p_tva_cents: decision.tvaCents ?? undefined,
          p_pays_client: decision.paysClient ?? undefined,
        });

        if (error) throw error;
        return NextResponse.json({ recu: true, resultat: data });
      }

      // ── Échec de prélèvement ────────────────────────────────────────────
      // On marque, on ne coupe pas. Le délai de grâce avant révocation n'est
      // pas arbitré (§8.7), et couper un accès sur un premier échec — carte
      // expirée, plafond atteint — se paie en résiliations.
      case 'payment.failed': {
        const adhesion = (donnees as PaiementWhop).membership_id;

        if (typeof adhesion === 'string') {
          await supabase
            .from('subscriptions')
            .update({ statut: 'impayee' })
            .eq('provider', 'whop')
            .eq('provider_subscription_id', adhesion);
        }

        return NextResponse.json({ recu: true });
      }

      // ── Résiliation demandée, à effet différé ───────────────────────────
      // Le portail Whop permet au client de résilier lui-même : cet événement
      // arrivera pour de vrai, là où son équivalent Stripe ne se déclenchait
      // qu'à la fin. Il va dans les deux sens — on peut revenir sur une
      // résiliation —, donc on lit le drapeau plutôt que de supposer.
      case 'membership.cancel_at_period_end_changed': {
        const adhesion = donnees.id;
        const resilie = donnees.cancel_at_period_end === true;

        if (typeof adhesion === 'string') {
          await supabase
            .from('subscriptions')
            .update(
              resilie
                ? { statut: 'resiliee', resiliation_demandee_le: new Date().toISOString() }
                : { statut: 'active', resiliation_demandee_le: null },
            )
            .eq('provider', 'whop')
            .eq('provider_subscription_id', adhesion);
        }

        return NextResponse.json({ recu: true, resiliee: resilie });
      }

      // ── Adhésion éteinte ────────────────────────────────────────────────
      // L'accès court jusqu'à la fin de la période déjà payée, et la révocation
      // quotidienne s'en charge le moment venu. Couper tout de suite
      // reviendrait à ne pas rendre le mois encaissé.
      case 'membership.deactivated': {
        const adhesion = donnees.id;

        if (typeof adhesion === 'string') {
          await supabase
            .from('subscriptions')
            .update({ statut: 'resiliee', resiliation_demandee_le: new Date().toISOString() })
            .eq('provider', 'whop')
            .eq('provider_subscription_id', adhesion);
        }

        return NextResponse.json({ recu: true });
      }

      // ── Litiges ─────────────────────────────────────────────────────────
      // Tous les événements d'un litige passent par la même fonction : elle
      // crée la ligne au premier, la fait avancer ensuite, et ignore un
      // événement en retard qui la ferait reculer.
      case 'dispute.created':
      case 'dispute.updated': {
        const litige = donnees as Record<string, unknown>;
        const montantCents = decimalVersCents(litige.amount);
        const echeance = litige.due_at ?? litige.evidence_due_at;

        const { data, error } = await supabase.rpc('enregistrer_litige', {
          p_provider: 'whop',
          p_event_id: idEvenement,
          p_event_type: evenement.type,
          p_payload: payload,
          p_provider_dispute_id: String(litige.id ?? idEvenement),
          p_references: referencesDuPaiement(litige),
          p_montant_cents: montantCents ?? 0,
          p_statut: statutLitige(litige.status),
          p_motif: typeof litige.reason === 'string' ? litige.reason : undefined,
          p_deadline: typeof echeance === 'string' ? echeance : undefined,
        });

        if (error) throw error;
        return NextResponse.json({ recu: true, resultat: data });
      }

      // ── Remboursement ───────────────────────────────────────────────────
      // Qu'il vienne du back-office ou du tableau de bord Whop. Le premier est
      // reconnu (`metadata.refund_id`, ou son identifiant déjà connu) ; le
      // second est enregistré, et referme l'accès s'il solde le paiement.
      case 'refund.created':
      case 'refund.updated': {
        const remboursement = donnees as Record<string, unknown>;
        const montantCents = decimalVersCents(remboursement.amount);

        // Un remboursement dont on ne sait pas lire le montant ne peut pas
        // être comparé à l'encaissement : `enregistrer_remboursement_
        // prestataire()` ne saurait pas s'il le solde, donc s'il faut refermer
        // l'accès. Mieux vaut le nommer que de refermer au hasard.
        if (montantCents === null) {
          await supabase.from('automation_logs').insert({
            declencheur: 'whop.remboursement',
            entite_type: 'refunds',
            statut: 'echec',
            details: {
              event: idEvenement,
              raison: 'Montant illisible',
              remboursement: remboursement as Json,
            },
          });
          return NextResponse.json({ recu: true, ignore: 'montant illisible' });
        }

        const metadonnees = (remboursement.metadata ?? {}) as Record<string, string | undefined>;

        const { data, error } = await supabase.rpc('enregistrer_remboursement_prestataire', {
          p_provider: 'whop',
          p_event_id: idEvenement,
          p_event_type: evenement.type,
          p_payload: payload,
          p_provider_refund_id: String(remboursement.id ?? idEvenement),
          p_references: referencesDuPaiement(remboursement),
          p_montant_cents: montantCents,
          p_refund_id: metadonnees.refund_id || undefined,
        });

        if (error) throw error;
        return NextResponse.json({ recu: true, resultat: data });
      }

      default:
        // Whop envoie bien plus d'événements qu'on n'en traite. Acquitter les
        // autres évite qu'ils s'accumulent en échec dans son tableau de bord,
        // où ils masqueraient ceux qui comptent.
        return NextResponse.json({ recu: true, ignore: evenement.type });
    }
  } catch (erreur) {
    await supabase.from('automation_logs').insert({
      declencheur: 'whop.webhook',
      entite_type: 'payment_events',
      statut: 'echec',
      details: {
        event: idEvenement,
        type: evenement.type,
        erreur: erreur instanceof Error ? erreur.message : String(erreur),
      },
    });

    // 500 volontaire : Whop rejouera, et l'idempotence rend le rejeu sans
    // danger. Répondre 200 sur un échec ferait disparaître le paiement.
    return NextResponse.json({ erreur: 'Traitement impossible' }, { status: 500 });
  }
}

type Client = ReturnType<typeof createServiceRoleClient>;

/**
 * Premier paiement ou renouvellement ?
 *
 * Whop envoie le même événement pour les deux. Stripe se distinguait par
 * `billing_reason === 'subscription_cycle'` ; ici on interroge l'état de la
 * base plutôt qu'une chaîne de caractères dont la documentation ne donne pas
 * les valeurs — et qu'on aurait devinée.
 *
 * L'enjeu est net : compter un premier paiement comme un renouvellement
 * offrirait un mois de plus à chaque souscription, et l'inverse créerait une
 * seconde inscription pour un client qui en a déjà une.
 *
 * Le rejeu reste sans danger même si ce tri se trompe : les deux fonctions
 * posent la même garde d'idempotence sur `(provider, provider_event_id)`, donc
 * un même événement ne peut être compté qu'une fois, quelle que soit la
 * branche qui l'accueille.
 */
async function estUnRenouvellement(supabase: Client, adhesion: string): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('provider', 'whop')
    .eq('provider_subscription_id', adhesion)
    .maybeSingle();

  return Boolean(data);
}

/**
 * Un encaissement qu'on n'a pas su rattacher, nommé dans le back-office.
 *
 * Il y en aura : le client a diffusé seize liens de paiement Whop avant que le
 * site ne sache en ouvrir, et un lien envoyé en message privé ne se rappelle
 * pas. Sans métadonnées, on ne sait ni qui a payé, ni quoi.
 *
 * **On ne devine pas, et on n'ouvre surtout pas l'accès sur une ressemblance.**
 * On pourrait : rapprocher l'adresse email d'un compte, le plan d'un produit.
 * Mais deux choses l'interdisent. La première est que ce serait affirmer ce
 * qu'on ne sait pas — la faute que ce projet corrige depuis le 13 septembre.
 * La seconde est plus concrète : un paiement passé hors du site n'a **aucune
 * acceptation des CGV enregistrée** dans `consents`, et la règle posée le
 * 21 septembre est « pas de preuve, pas de vente ». Ouvrir l'accès ici
 * contournerait en silence toute la chaîne juridique.
 *
 * Ce qu'on fait à la place : on rassemble tout ce qui permet à un humain de
 * trancher en quelques secondes — l'email de l'acheteur, le produit reconnu
 * par son plan, le montant — et on le range là où le back-office le montre.
 * `echec` et non `ignore` : `automation_statut` ne connaît que trois valeurs,
 * et celle-ci veut dire « il faut quelqu'un », ce qui est exactement le cas.
 */
async function rattraper(
  supabase: Client,
  idEvenement: string,
  paiement: PaiementWhop,
  raison: string,
): Promise<void> {
  const plan = typeof paiement.plan_id === 'string' ? paiement.plan_id : null;

  // Le produit, s'il porte ce plan. C'est la moitié de la question à laquelle
  // `formations.whop_plan_id` sait répondre sans métadonnées.
  const { data: formation } = plan
    ? await supabase.from('formations').select('id, titre').eq('whop_plan_id', plan).maybeSingle()
    : { data: null };

  await supabase.from('automation_logs').insert({
    declencheur: 'whop.rattrapage',
    entite_type: 'payments',
    entite_id: formation?.id ?? null,
    statut: 'echec',
    details: {
      event: idEvenement,
      raison,
      paiement: paiement.id ?? null,
      email: typeof paiement.customer_email === 'string' ? paiement.customer_email : null,
      plan,
      produit: formation?.titre ?? null,
      montant_cents: decimalVersCents(paiement.total),
      devise: paiement.currency ?? null,
      adhesion: typeof paiement.membership_id === 'string' ? paiement.membership_id : null,
    },
  });
}
