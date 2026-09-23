/**
 * La frontière entre l'argent de Whop et le nôtre.
 *
 * `CLAUDE.md` pose une règle sans exception : **l'argent est en centimes, en
 * entier, jamais de flottant.** Whop, lui, expose ses montants en décimales —
 * `initial_price: 290` à l'envoi, `"290.00"` au retour. Toute la conversion
 * vit donc ici, dans deux fonctions testées, plutôt que dispersée en
 * `Math.round(x * 100)` au fil des appels.
 *
 * Pourquoi ça mérite un fichier : `parseFloat('19.99') * 100` vaut
 * 1998.9999999999998. `Math.round` le rattrape à cette échelle, et c'est
 * exactement ce qui rend le défaut invisible — il ne se manifeste pas sur les
 * montants qu'on teste à la main, seulement plus loin, sur un montant plus
 * grand ou une division de plus. On ne passe donc jamais par le flottant : on
 * lit la chaîne décimale et on assemble des entiers.
 */

/** Le nombre de centimes, tel que Whop veut le recevoir : en décimales. */
export function centsVersDecimal(cents: number): number {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`Montant en centimes attendu, reçu : ${cents}`);
  }
  // Construit depuis la chaîne plutôt que par `cents / 100` : le résultat est
  // le même double, mais l'intention est lisible et le test porte sur elle.
  return Number(`${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`);
}

/**
 * Le montant rendu par Whop, en centimes entiers — ou `null` si on ne sait pas
 * le lire.
 *
 * `null` n'est pas un échec silencieux, c'est la même règle que la TVA : **une
 * valeur qu'on n'a pas su lire ne s'écrit jamais comme un zéro.** Un zéro
 * inventé devient un encaissement à 0 €, une facture fausse et un chiffre
 * d'affaires faux, sans que rien ne signale d'où ça vient.
 *
 * Les formes acceptées couvrent ce que la documentation décrit (les montants
 * d'un `Payment` sont des objets portant une chaîne exacte) et ce qu'elle
 * laisse ouvert. **La forme réelle n'a pas été vue en vrai** : le compte Whop
 * n'a pas encore servi. D'où la tolérance ici — et le `null` partout ailleurs.
 */
export function decimalVersCents(valeur: unknown): number | null {
  const brut = extraireMontant(valeur);
  if (brut === null) return null;

  const texte = brut.trim();
  // Ni notation scientifique, ni signe, ni séparateur de milliers : on ne
  // devine pas un format, on refuse ce qu'on ne reconnaît pas.
  if (!/^\d+(\.\d+)?$/.test(texte)) return null;

  const [entier, fraction = ''] = texte.split('.');
  const centimes = Number(entier) * 100 + Number((fraction + '00').slice(0, 2));

  // Une troisième décimale existe sur certaines taxes. On arrondit au centime
  // supérieur à partir de 5, comme le ferait un relevé bancaire.
  const arrondi = fraction.length > 2 && Number(fraction[2]) >= 5 ? 1 : 0;

  const total = centimes + arrondi;
  return Number.isSafeInteger(total) ? total : null;
}

/** Ramène les formes connues d'un montant Whop à une chaîne décimale. */
function extraireMontant(valeur: unknown): string | null {
  if (typeof valeur === 'string') return valeur;
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? String(valeur) : null;

  if (valeur && typeof valeur === 'object') {
    // `Payment.total` et consorts sont décrits comme des objets portant le
    // montant exact. Le nom du champ n'est pas garanti : on essaie les deux
    // qu'on a vus, et on abandonne plutôt que d'inventer.
    for (const cle of ['amount', 'value'] as const) {
      const interne = (valeur as Record<string, unknown>)[cle];
      if (typeof interne === 'string' || typeof interne === 'number') {
        return String(interne);
      }
    }
  }

  return null;
}
