/**
 * Quel rôle Discord ouvre l'accès à un produit, et deux noms désignent-ils le
 * même rôle.
 *
 * Extrait de `roles-catalogue.ts` pour la même raison que `montants-whop.ts`
 * l'est du webhook : c'est la partie qui décide, elle est pure, donc elle se
 * teste. Le reste du script n'est que des appels réseau autour.
 */

/**
 * Le rôle d'un produit, quand ce n'est pas simplement son titre.
 *
 * **Un rôle peut servir deux produits**, et c'est ici le cas voulu : APEX PRIME
 * se vend au mois et à l'année, mais c'est le même accès — deux rôles
 * donneraient deux salons pour la même chose, et un client qui passe du mensuel
 * à l'annuel en porterait deux.
 *
 * Ce partage est sûr par construction : `revoquer_acces_expires()` vérifie,
 * avant chaque retrait, qu'aucune **autre inscription active du même client**
 * ne porte ce rôle — c'est son compteur `roles_conserves`. L'abonné annuel ne
 * perd donc rien quand son mensuel expire.
 *
 * **Reste une question pour le client** : APEX PARTNER et sa formule lancement
 * donnent-ils accès aux mêmes salons ? Ici, on suppose que non — deux produits
 * distincts, deux rôles. Les réunir plus tard est une ligne dans cette table ;
 * les séparer après coup demande de reprendre les membres un par un.
 */
const ROLE_PAR_SLUG: Record<string, string> = {
  'apex-prime': 'APEX PRIME',
  'apex-prime-annuel': 'APEX PRIME',
};

/**
 * Le nom du rôle attendu pour ce produit.
 *
 * Par défaut le titre, à l'identique : c'est le nom que le client lit dans son
 * back-office, celui qui figure sur sa facture, et celui qu'il verra dans la
 * liste des rôles du serveur. Le code, lui, ne compare que des identifiants —
 * le nom n'est là que pour les humains, et c'est pour eux qu'il doit être
 * évident.
 */
export function roleDuProduit(slug: string, titre: string): string {
  return ROLE_PAR_SLUG[slug] ?? titre;
}

/**
 * Deux noms de rôle désignent-ils la même chose ?
 *
 * **Le cas qui arrive** : quelqu'un crée les rôles à la main sur Discord, à
 * partir de la liste du catalogue, et tape « APEX PARTNER - 6 mois lancement »
 * là où le produit s'appelle « APEX PARTNER — 6 mois lancement ». Un tiret
 * court au lieu d'un cadratin, invisible à la lecture. Une comparaison stricte
 * y verrait un rôle inconnu et en créerait un second : deux rôles pour un même
 * produit, dont un seul ouvre l'accès, et une liste de rôles que plus personne
 * ne sait lire.
 *
 * On compare donc à la casse, aux espaces et à la forme du tiret près — et pas
 * au-delà : « PALACE 1 » et « PALACE 2 » doivent rester deux rôles.
 */
export function memeNom(a: string, b: string): boolean {
  const normaliser = (texte: string) =>
    texte
      .normalize('NFKC')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase('fr');

  return normaliser(a) === normaliser(b);
}
