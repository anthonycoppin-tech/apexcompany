'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { ouvrirCheckout } from '@/lib/paiement/checkout';

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

  // ── L'email doit être vérifié avant de payer ─────────────────────────────
  // Décision consignée en §8 : non bloquante pour prendre rendez-vous,
  // bloquante avant le paiement. Une facture qui part vers une adresse non
  // vérifiée est une facture qu'on ne peut pas prouver avoir envoyée.
  if (!user.email_confirmed_at) {
    return {
      erreur:
        'Vérifie d’abord ton adresse email : nous t’avons envoyé un lien à la création de ton compte. C’est ce qui garantit que ta facture arrive bien chez toi.',
    };
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  // Mutualisé avec la souscription directe à un abonnement : les deux parcours
  // doivent produire exactement la même chose en base, métadonnées comprises —
  // sans elles, le webhook ne sait pas qui a payé quoi.
  const resultat = await ouvrirCheckout({
    userId: user.id,
    email: user.email ?? undefined,
    formation: {
      id: proposition.formation_id,
      titre: proposition.formations.titre,
      type_produit: proposition.formations.type_produit,
      devise: proposition.devise,
    },
    montantCents: proposition.montant_cents,
    propositionId: proposition.id,
    urlSucces: `${site}/espace?paiement=ok`,
    urlAnnulation: `${site}/espace/propositions/${proposition.id}?paiement=annule`,
  });

  if ('erreur' in resultat) return { erreur: resultat.erreur };

  // Hors de tout try/catch : `redirect` lève une exception pour interrompre le
  // rendu, et un catch la prendrait pour un échec.
  redirect(resultat.url);
}
