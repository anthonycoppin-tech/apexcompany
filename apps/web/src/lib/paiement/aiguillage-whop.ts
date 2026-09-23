import { decimalVersCents } from './montants-whop.ts';
import { taxeDePaiement, type PaiementWhop as PaiementTaxable } from './taxe-whop.ts';

/**
 * Ce qu'il faut faire d'un encaissement Whop — décidé sans toucher à la base.
 *
 * **Pourquoi ce fichier existe.** `payment.succeeded` recouvre trois situations
 * qui n'ont rien à voir : un premier paiement, un renouvellement d'abonnement,
 * et un encaissement arrivé par un des seize liens diffusés hors du site. Se
 * tromper de branche coûte cher dans les deux sens — compter un premier
 * paiement comme un renouvellement offre un mois à chaque souscription, et
 * l'inverse crée une seconde inscription à quelqu'un qui en a déjà une.
 *
 * Tant que ce tri vivait dans le handler, il était intestable : le handler
 * importe `next/server` et la clé de service. Ici, c'est une fonction pure —
 * on lui donne l'événement et **la seule chose qu'elle ne peut pas savoir**
 * (cette adhésion est-elle déjà connue ?), elle rend une décision qu'on lit.
 *
 * Le handler redevient ce qu'il doit être : poser une question à la base,
 * appeler cette fonction, exécuter sa réponse.
 */

export type PaiementWhop = PaiementTaxable & {
  id?: string;
  membership_id?: unknown;
  plan_id?: unknown;
  currency?: string;
  total?: unknown;
  customer_email?: unknown;
  metadata?: unknown;
};

/** Ce que les deux branches d'encaissement partagent. */
type Encaissement = {
  montantCents: number;
  devise: string;
  referencePaiement: string;
  tvaCents: number | null;
  paysClient: string | null;
};

export type Decision =
  | ({ type: 'renouvellement'; adhesion: string } & Encaissement)
  | ({
      type: 'premier-paiement';
      userId: string;
      formationId: string;
      commande: string;
      propositionId: string | null;
      adhesion: string | null;
    } & Encaissement)
  | { type: 'rattrapage'; raison: string };

export function decisionEncaissement(
  paiement: PaiementWhop,
  contexte: { adhesionConnue: boolean },
): Decision {
  const montantCents = decimalVersCents(paiement.total);

  // **Un montant illisible ne se devine pas**, et rejouer ne le rendra pas
  // lisible. On ne peut ni l'encaisser ni l'ignorer : quelqu'un a payé. Il part
  // donc dans la file de rattrapage, où un humain le lira dans Whop.
  if (montantCents === null) {
    return { type: 'rattrapage', raison: 'Montant illisible' };
  }

  const adhesion = typeof paiement.membership_id === 'string' ? paiement.membership_id : null;
  const taxe = taxeDePaiement(paiement);

  const encaissement: Encaissement = {
    montantCents,
    devise: (paiement.currency ?? 'EUR').toUpperCase(),
    referencePaiement: paiement.id ?? '',
    tvaCents: taxe.tvaCents,
    paysClient: taxe.pays,
  };

  // **Le tri se fait sur l'état de la base, pas sur une chaîne de caractères.**
  // Whop expose bien un `billing_reason`, mais sa documentation n'en donne pas
  // les valeurs : les deviner, c'est se tromper au premier changement de leur
  // côté. Une adhésion qu'on connaît déjà a forcément été ouverte par un
  // premier paiement — donc ce qui arrive est un renouvellement.
  if (adhesion && contexte.adhesionConnue) {
    return { type: 'renouvellement', adhesion, ...encaissement };
  }

  const metadonnees = (paiement.metadata ?? {}) as Record<string, unknown>;
  const lire = (cle: string) => {
    const valeur = metadonnees[cle];
    return typeof valeur === 'string' && valeur.length > 0 ? valeur : null;
  };

  const userId = lire('user_id');
  const formationId = lire('formation_id');
  const commande = lire('commande');

  // Les métadonnées sont le seul lien entre Whop et notre base. Sans elles,
  // impossible de savoir qui a payé quoi — et **les trois sont nécessaires** :
  // sans `commande`, `traiter_paiement()` ne retrouve pas la commande déposée
  // en attente et en crée une seconde.
  if (!userId || !formationId || !commande) {
    return { type: 'rattrapage', raison: 'Métadonnées absentes' };
  }

  return {
    type: 'premier-paiement',
    userId,
    formationId,
    commande,
    propositionId: lire('proposition_id'),
    adhesion,
    ...encaissement,
    // Faute de commande ouverte par le site, la référence de commande fait
    // office de référence d'encaissement.
    referencePaiement: paiement.id ?? commande,
  };
}
