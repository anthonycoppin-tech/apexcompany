import crypto from 'node:crypto';

/**
 * La signature des webhooks Resend, au format Svix (« Standard Webhooks »).
 *
 * L'URL d'un webhook est publique : sans vérification, n'importe qui pourrait
 * poster un `email.bounced` et faire passer pour perdu un email bien arrivé —
 * ou, plus utile à un attaquant, noyer `/admin/emails` sous de faux rebonds
 * jusqu'à ce que plus personne ne les regarde.
 *
 * Trois éléments entrent dans la signature, et les trois comptent :
 * l'identifiant de la livraison, son horodatage et le corps **brut**. Signer
 * le seul corps laisserait rejouer indéfiniment une capture ancienne.
 *
 * Écrit à la main plutôt qu'avec le paquet `svix` : c'est un HMAC de vingt
 * lignes, et le projet évite déjà le SDK Resend pour la même raison — une
 * dépendance de moins à tenir à jour sur un chemin qui ne bouge pas.
 */

/** Tolérance de Svix. Au-delà, on refuse : une signature valide reste valide, une capture rejouée vieillit. */
const TOLERANCE_MS = 5 * 60 * 1000;

export type EntetesSignature = {
  id: string | null;
  horodatage: string | null;
  signature: string | null;
};

/**
 * Svix envoie `svix-*`, la spécification Standard Webhooks `webhook-*`, et
 * certains relais réécrivent l'un en l'autre. On accepte les deux : refuser
 * sur la casse d'un en-tête donnerait une panne indéchiffrable.
 */
export function entetesDe(requete: Request): EntetesSignature {
  const lire = (nom: string) =>
    requete.headers.get(`svix-${nom}`) ?? requete.headers.get(`webhook-${nom}`);

  return { id: lire('id'), horodatage: lire('timestamp'), signature: lire('signature') };
}

/** `whsec_<base64>` est la forme affichée par Resend ; le secret réel est ce que ce base64 encode. */
function cleDuSecret(secret: string): Buffer {
  return Buffer.from(
    secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret,
    'base64',
  );
}

/**
 * Comparaison à temps constant, comme dans `api/cal` : une comparaison naïve
 * sort plus tôt quand les premiers octets diffèrent, ce qui suffit à deviner
 * une signature octet par octet.
 */
function memeSignature(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function signatureValide(
  corps: string,
  entetes: EntetesSignature,
  secret: string,
  maintenant = Date.now(),
): boolean {
  const { id, horodatage, signature } = entetes;
  if (!id || !horodatage || !signature) return false;

  const secondes = Number(horodatage);
  if (!Number.isFinite(secondes)) return false;
  if (Math.abs(maintenant - secondes * 1000) > TOLERANCE_MS) return false;

  const attendue = crypto
    .createHmac('sha256', cleDuSecret(secret))
    .update(`${id}.${horodatage}.${corps}`)
    .digest('base64');

  // L'en-tête porte une liste séparée par des espaces — `v1,<sig> v2,<sig>` —
  // pour que Svix puisse faire tourner un secret sans coupure. Une seule
  // version `v1` qui correspond suffit.
  return signature
    .split(' ')
    .filter((partie) => partie.startsWith('v1,'))
    .some((partie) => memeSignature(partie.slice('v1,'.length), attendue));
}

/**
 * Exposée pour les tests : fabriquer une signature valide sans réimplémenter
 * le calcul. Renvoie la signature **nue**, sans le `v1,` — c'est au test de
 * composer l'en-tête, puisque c'est justement sa forme qu'il vérifie.
 */
export function signerPourTest(corps: string, id: string, horodatage: string, secret: string) {
  return crypto
    .createHmac('sha256', cleDuSecret(secret))
    .update(`${id}.${horodatage}.${corps}`)
    .digest('base64');
}
