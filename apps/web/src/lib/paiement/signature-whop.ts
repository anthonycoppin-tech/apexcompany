import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * La signature des webhooks Whop — spécification « Standard Webhooks ».
 *
 * Ce fichier vit à part du handler pour une raison : c'est la seule partie du
 * chemin de l'argent qui décide si une requête est légitime, et la seule qu'on
 * puisse éprouver sans compte Whop. Le reste du webhook n'est que de
 * l'aiguillage vers des fonctions SQL déjà testées.
 *
 * Trois différences avec Stripe, chacune capable de tout faire échouer :
 *
 * - **Le contenu signé est `{webhook-id}.{webhook-timestamp}.{corps brut}`**,
 *   pas le corps seul. Le corps doit être lu en texte et jamais reparsé puis
 *   resérialisé : `JSON.stringify(JSON.parse(x))` ne rend pas toujours `x`, et
 *   la signature porte sur les octets reçus.
 * - **La clé est la chaîne du secret telle quelle**, préfixe `ws_` compris. La
 *   spécification d'origine décode en base64 ce qui suit le préfixe ; la
 *   documentation de Whop dit explicitement de ne faire ni l'un ni l'autre.
 * - **L'horodatage se vérifie ici**, et c'est notre seule protection contre le
 *   rejeu — le SDK de Stripe l'assurait. Une signature valide le reste pour
 *   toujours : sans fenêtre, un appel ancien capté par un tiers et renvoyé
 *   serait accepté sans réserve.
 *
 * **Non vérifié contre le vrai service** : les tests prouvent que
 * l'implémentation est cohérente avec elle-même et avec l'algorithme décrit,
 * pas que Whop signe exactement ainsi. Le bac à sable lève la réserve.
 */

/** Cinq minutes, la tolérance recommandée par la spécification. */
const FENETRE_SECONDES = 5 * 60;

export type EnTetesWhop = {
  id: string | null;
  horodatage: string | null;
  signature: string | null;
};

export type Verdict =
  { valide: true } | { valide: false; raison: 'en-tetes' | 'horodatage' | 'signature' };

/** Le contenu réellement signé. Exporté pour que les tests signent comme Whop. */
export function contenuSigne(id: string, horodatage: string, corps: string): string {
  return `${id}.${horodatage}.${corps}`;
}

/** La signature attendue, en base64. */
export function signer(secret: string, contenu: string): string {
  return createHmac('sha256', secret).update(contenu, 'utf8').digest('base64');
}

export function verifierSignature(
  secret: string,
  entetes: EnTetesWhop,
  corps: string,
  maintenant: number = Date.now(),
): Verdict {
  const { id, horodatage, signature } = entetes;
  if (!id || !horodatage || !signature) return { valide: false, raison: 'en-tetes' };

  const envoyeA = Number(horodatage);
  if (!Number.isFinite(envoyeA)) return { valide: false, raison: 'horodatage' };

  // La fenêtre joue dans les deux sens : une horloge de serveur en avance
  // produit un horodatage futur, qui n'est pas plus légitime qu'un vieux.
  const ecart = Math.abs(Math.floor(maintenant / 1000) - envoyeA);
  if (ecart > FENETRE_SECONDES) return { valide: false, raison: 'horodatage' };

  const attendue = signer(secret, contenuSigne(id, horodatage, corps));

  // L'en-tête peut porter PLUSIEURS signatures séparées par une espace, le
  // temps d'une rotation de secret. N'en accepter qu'une ferait échouer tous
  // les appels pendant la rotation, c'est-à-dire au pire moment.
  const candidates = signature
    .split(' ')
    .filter((part) => part.startsWith('v1,'))
    .map((part) => part.slice(3));

  const valide = candidates.some((candidate) => egalesEnTempsConstant(candidate, attendue));
  return valide ? { valide: true } : { valide: false, raison: 'signature' };
}

/**
 * Comparaison à temps constant.
 *
 * Une comparaison par `===` s'arrête au premier octet qui diffère, et le temps
 * qu'elle met révèle combien d'octets étaient justes — de quoi reconstituer
 * une signature valide octet par octet.
 */
function egalesEnTempsConstant(a: string, b: string): boolean {
  const gauche = Buffer.from(a, 'utf8');
  const droite = Buffer.from(b, 'utf8');
  // `timingSafeEqual` exige la même longueur ; la comparer d'abord ne révèle
  // rien qu'un attaquant ignore (la taille d'un SHA-256 en base64).
  return gauche.length === droite.length && timingSafeEqual(gauche, droite);
}
