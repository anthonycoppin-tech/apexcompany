import 'server-only';

import Stripe from 'stripe';

/**
 * Client Stripe — serveur uniquement.
 *
 * `import 'server-only'` fait échouer le build si ce fichier finit importé
 * depuis un composant client : la clé secrète Stripe ouvre l'accès à tous les
 * paiements du compte, et une clé envoyée au navigateur ne se révoque qu'après
 * coup.
 *
 * Instancié à la demande plutôt qu'au chargement du module : sans ça, un simple
 * import ferait échouer le build des environnements où la clé n'est pas encore
 * renseignée — ce qui est aujourd'hui le cas de tous.
 */
export function stripe(): Stripe {
  const cle = process.env.STRIPE_SECRET_KEY;

  if (!cle) {
    throw new Error(
      'STRIPE_SECRET_KEY manquante. Cette clé ne doit jamais être préfixée NEXT_PUBLIC_ ' +
        'et ne vit que côté serveur.',
    );
  }

  return new Stripe(cle);
}
