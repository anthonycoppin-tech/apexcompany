/**
 * Le vocabulaire des messages — un seul, pour tout le site.
 *
 * Avant ce fichier, cinq mécaniques se partageaient le besoin : un `useState`
 * local, quatorze types d'état de `useActionState` dont trois formes
 * incompatibles, quatre conventions de paramètre d'URL, un bloc serveur dérivé
 * d'un état, et de la validation de champ en ligne. Le coût n'était pas
 * esthétique : deux messages ne portaient aucun rôle ARIA — dont « Paiement
 * reçu », le plus important du produit — et un troisième était envoyé vers une
 * page qui ne le lisait pas.
 *
 * Un `Message` ne porte jamais de classes ni de rôle : c'est
 * `components/message.tsx` qui les dérive du ton. C'est ce qui rend impossible
 * d'afficher un message muet — on ne peut pas en écrire un sans passer par le
 * composant qui pose le rôle.
 */

/**
 * Trois tons, et pas un de plus.
 *
 * `alerte` plutôt que `erreur` pour deux raisons : le token de couleur
 * s'appelle déjà `--color-alerte`, et `erreur` est le nom que prend une
 * variable locale dans la moitié des fichiers d'actions — un import qui la
 * masque se repère mal.
 */
export type Ton = 'succes' | 'alerte' | 'info';

export type Message = {
  readonly ton: Ton;
  readonly texte: string;
};

export const succes = (texte: string): Message => ({ ton: 'succes', texte });
export const alerte = (texte: string): Message => ({ ton: 'alerte', texte });
export const info = (texte: string): Message => ({ ton: 'info', texte });

/**
 * L'état que renvoie une action serveur, pour tous les formulaires du site.
 *
 * **Union discriminée, et pas un `{ erreur, ok }` aplati.** Deux raisons :
 *
 * - `{ erreur: 'x', ok: true }` était représentable et ne veut rien dire. Ici
 *   l'état impossible ne se compile pas.
 * - le succès ne sert pas qu'à afficher une phrase. `BoutonResilier` change
 *   d'interface entière quand l'action aboutit, et `FormulaireTemoignage`
 *   pourrait le faire demain. `etat.statut === 'succes'` reste donc un test de
 *   comportement, pas seulement la présence d'un texte.
 */
export type EtatAction =
  | { readonly statut: 'repos' }
  | { readonly statut: 'succes'; readonly message: Message }
  | { readonly statut: 'echec'; readonly message: Message };

/** L'état de départ d'un `useActionState`. Une constante, jamais reconstruite. */
export const REPOS: EtatAction = { statut: 'repos' };

export const reussi = (texte: string): EtatAction => ({
  statut: 'succes',
  message: succes(texte),
});

export const echoue = (texte: string): EtatAction => ({
  statut: 'echec',
  message: alerte(texte),
});

/** Le message d'un état, ou `null` au repos — ce que le composant attend. */
export const messageDe = (etat: EtatAction): Message | null =>
  etat.statut === 'repos' ? null : etat.message;
