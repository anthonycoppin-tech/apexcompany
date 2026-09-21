/**
 * Ce que le webhook Resend a le droit de changer dans le registre.
 *
 * Fonction pure, séparée de la route pour être testée sans base — même raison
 * que `registre.ts` : c'est elle qui décide si un email compte comme reçu, et
 * une erreur ici se paie d'une page qui affirme ce qui n'est pas.
 *
 * **Le prestataire ne garantit pas l'ordre d'arrivée.** Un `email.delivered`
 * peut nous parvenir après un `email.complained` du même envoi — les deux sont
 * vrais, ils décrivent deux moments. Si le dernier arrivé gagnait, une plainte
 * disparaîtrait derrière une livraison, et personne ne saurait que ce
 * destinataire nous a signalés comme indésirables.
 *
 * D'où un rang, et une règle unique : **on n'avance jamais vers un état moins
 * grave.** `rebond` et `plainte` sont terminaux.
 */

/** Les états que le webhook peut poser, du moins grave au plus grave. */
export type StatutEvenement = 'livre' | 'rebond' | 'plainte';

/**
 * Le rang dit ce qui l'emporte quand deux événements se croisent, pas une
 * chronologie. `en_cours` et `echec` partagent le rang le plus bas : ce sont
 * les deux états que la tâche d'envoi peut encore reprendre, donc les deux que
 * n'importe quelle nouvelle du prestataire a le droit de remplacer.
 */
const RANG: Record<string, number> = {
  en_cours: 0,
  echec: 0,
  envoye: 1,
  livre: 2,
  rebond: 3,
  plainte: 4,
};

/**
 * Les événements Resend qu'on traite. Les autres (`email.sent`,
 * `email.opened`, `email.clicked`, `email.delivery_delayed`) n'apprennent rien
 * que le registre ne sache déjà, ou rien d'actionnable : on les acquitte sans
 * rien écrire plutôt que de remplir le journal de bruit.
 */
const EVENEMENTS: Record<string, StatutEvenement> = {
  'email.delivered': 'livre',
  'email.bounced': 'rebond',
  'email.complained': 'plainte',
};

/**
 * `Object.hasOwn`, et non `EVENEMENTS[type] ?? null` : le type vient du corps
 * de la requête, donc de l'extérieur, et `{}['constructor']` répond une
 * fonction bien vérité. Sans ce garde-fou, un événement nommé `constructor`
 * ou `toString` passait pour un événement connu.
 */
export const statutDeLEvenement = (type: string): StatutEvenement | null =>
  Object.hasOwn(EVENEMENTS, type) ? EVENEMENTS[type] : null;

/** Un rebond ou une plainte demande une action humaine ; une livraison, non. */
export const demandeAttention = (statut: StatutEvenement): boolean => statut !== 'livre';

/**
 * `true` si l'événement doit écraser l'état actuel de la ligne.
 *
 * Le cas d'égalité renvoie `false` : un même événement rejoué — le
 * prestataire réessaie dès que notre réponse tarde — ne réécrit rien.
 */
export function remplace(actuel: string, nouveau: StatutEvenement): boolean {
  // Un statut inconnu vient d'une version plus récente du schéma que celle que
  // ce code connaît. Ne rien écrire est le seul choix sûr : on ne sait pas si
  // ce qu'on remplacerait est plus grave. `hasOwn` pour la même raison que
  // dans `statutDeLEvenement` — `actuel` est lu en base, mais un `RANG` hérité
  // d'`Object` ferait passer la comparaison par un chemin qu'on n'a pas voulu.
  if (!Object.hasOwn(RANG, actuel)) return false;

  return RANG[nouveau] > RANG[actuel];
}

type Rebond = { message?: string; type?: string; subType?: string };

/**
 * La raison lisible d'un rebond, telle qu'elle s'affichera dans
 * `/admin/emails` en face de l'adresse. `type` distingue le définitif
 * (« Permanent », l'adresse n'existe pas) du temporaire (« Transient », boîte
 * pleine) : c'est ce qui décide entre corriger l'adresse et réessayer plus
 * tard, donc la première chose à lire.
 */
export function raisonDuRebond(statut: StatutEvenement, rebond: Rebond | undefined): string | null {
  if (statut === 'plainte') return 'Marqué comme indésirable par le destinataire';
  if (statut !== 'rebond') return null;

  const morceaux = [rebond?.type, rebond?.message].filter(
    (m): m is string => typeof m === 'string' && m.trim() !== '',
  );
  return morceaux.length > 0 ? `Rebond — ${morceaux.join(' : ')}` : 'Rebond, sans motif transmis';
}
