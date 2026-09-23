import 'server-only';

/**
 * Client Whop — serveur uniquement.
 *
 * `import 'server-only'` fait échouer le build si ce fichier finit importé
 * depuis un composant client : la clé ouvre l'accès à tous les paiements du
 * compte, et une clé envoyée au navigateur ne se révoque qu'après coup.
 *
 * **Pourquoi `fetch` et pas le SDK.** La surface utilisée tient en trois
 * appels — ouvrir un paiement, rembourser, lire un paiement. En face, une
 * dépendance de plus dans un `package-lock.json` que `07-REPARTITION.md`
 * désigne comme l'un des trois fichiers qui posent réellement problème entre
 * les deux développeurs. Le compte n'est pas rentable.
 *
 * **Ce qui n'a pas été vérifié, et doit l'être avant d'ouvrir les ventes** :
 * rien de ce fichier n'a tourné contre le vrai service. Les chemins et les
 * champs viennent de la documentation, la forme exacte des réponses n'a pas
 * été vue. C'est la même réserve que Stripe portait depuis le 8 septembre,
 * sauf qu'ici les clés existent — le bac à sable Whop lève la réserve en une
 * heure, et c'est la première chose à faire.
 */

const BASE = 'https://api.whop.com/api/v1';

/** Les variables sans lesquelles aucun paiement ne peut s'ouvrir. */
export function whopConfigure(): boolean {
  return Boolean(process.env.WHOP_API_KEY && process.env.WHOP_ACCOUNT_ID);
}

/** L'identifiant du compte vendeur (`biz_…`), exigé à la création d'un paiement. */
export function whopCompte(): string {
  const compte = process.env.WHOP_ACCOUNT_ID;
  if (!compte) {
    throw new Error('WHOP_ACCOUNT_ID manquante (identifiant `biz_…` du tableau de bord Whop).');
  }
  return compte;
}

export class ErreurWhop extends Error {
  constructor(
    readonly statut: number,
    readonly corps: string,
  ) {
    super(`Whop a répondu ${statut} : ${corps.slice(0, 500)}`);
    this.name = 'ErreurWhop';
  }
}

/**
 * Un appel à l'API Whop, authentifié.
 *
 * `cleIdempotence` est envoyée en en-tête sur les écritures. **Sa prise en
 * compte par Whop n'est pas confirmée par la documentation** — l'exemple du
 * SDK la mentionne, le schéma REST ne la décrit pas. On l'envoie donc en
 * sachant qu'elle peut être ignorée : au pire elle ne sert à rien, elle ne
 * peut pas nuire. Ce qui compte, c'est de ne pas s'y fier comme unique
 * protection contre un double remboursement — voir le commentaire de
 * `executerRemboursement()`, qui pose le verrou là où il tient vraiment.
 */
export async function whopAppel<T>(
  chemin: string,
  options: { methode?: 'GET' | 'POST'; corps?: unknown; cleIdempotence?: string } = {},
): Promise<T> {
  const cle = process.env.WHOP_API_KEY;
  if (!cle) {
    throw new Error(
      'WHOP_API_KEY manquante. Cette clé ne doit jamais être préfixée NEXT_PUBLIC_ ' +
        'et ne vit que côté serveur.',
    );
  }

  const reponse = await fetch(`${BASE}${chemin}`, {
    method: options.methode ?? 'GET',
    headers: {
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/json',
      ...(options.cleIdempotence ? { 'Idempotency-Key': options.cleIdempotence } : {}),
    },
    body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
    // Un appel de paiement ne se met jamais en cache : Next.js met en cache
    // les `fetch` côté serveur par défaut sur certains chemins, et un
    // `purchase_url` recyclé enverrait deux clients sur le même paiement.
    cache: 'no-store',
  });

  if (!reponse.ok) {
    throw new ErreurWhop(reponse.status, await reponse.text().catch(() => ''));
  }

  return (await reponse.json()) as T;
}
