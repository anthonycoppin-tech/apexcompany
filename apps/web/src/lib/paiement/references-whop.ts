/**
 * Les identifiants par lesquels un remboursement ou un litige Whop retrouve
 * son encaissement.
 *
 * `enregistrer_litige()` et `enregistrer_remboursement_prestataire()` prennent
 * `p_references text[]` : le handler rassemble les identifiants candidats, la
 * base garde celui qu'elle connaît. C'est cette abstraction qui a permis de
 * changer de prestataire sans toucher à une seule signature SQL.
 *
 * Ce fichier remplace `references-stripe.ts`, et il tient en vingt lignes là où
 * l'autre en faisait soixante-seize. La différence n'est pas une simplification
 * de notre part : Stripe imposait de traverser PaymentIntent → Charge →
 * Invoice → InvoicePayment, avec un appel réseau supplémentaire **à l'intérieur
 * du webhook**. Whop pose l'identifiant du paiement directement dans la charge
 * utile, donc plus d'appel réseau sur le chemin critique.
 */

/** Les identifiants d'un paiement cités par une charge utile, dédoublonnés. */
export function referencesDuPaiement(donnees: unknown): string[] {
  if (!donnees || typeof donnees !== 'object') return [];
  const objet = donnees as Record<string, unknown>;

  const candidats = [
    objet.payment_id,
    (objet.payment as Record<string, unknown> | undefined)?.id,
    // Un événement de remboursement peut porter l'identifiant du paiement sous
    // `charge_id` selon la passerelle sous-jacente.
    objet.charge_id,
  ];

  return [...new Set(candidats.filter((c): c is string => typeof c === 'string' && c.length > 0))];
}

/**
 * Le statut Whop d'un litige, ramené aux cinq états du back-office.
 *
 * **Les valeurs exactes n'ont pas été vues** : la documentation ne les énumère
 * pas. On reconnaît donc par fragment plutôt que par égalité, et tout ce qui
 * n'est pas reconnu retombe sur `ouvert` — le plus prudent, puisque c'est
 * l'état qui réclame une réponse. Un litige rangé à tort comme clos est un
 * litige perdu par forfait.
 *
 * `enregistrer_litige()` n'accepte de toute façon que les avancées : un
 * événement arrivé en retard ne peut pas faire reculer l'état.
 */
export function statutLitige(
  statut: unknown,
): 'ouvert' | 'preuves_envoyees' | 'gagne' | 'perdu' | 'clos' {
  const texte = typeof statut === 'string' ? statut.toLowerCase() : '';

  if (texte.includes('won')) return 'gagne';
  if (texte.includes('lost')) return 'perdu';
  if (texte.includes('review') || texte.includes('evidence') || texte.includes('submitted')) {
    return 'preuves_envoyees';
  }
  if (texte.includes('closed') || texte.includes('canceled') || texte.includes('cancelled')) {
    return 'clos';
  }
  return 'ouvert';
}
