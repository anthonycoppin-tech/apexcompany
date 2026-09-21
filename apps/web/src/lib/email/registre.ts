/**
 * Quand une ligne du registre `emails_envoyes` peut être (re)prise.
 *
 * Fonction pure, séparée de la tâche pour être testée sans base : c'est elle
 * qui décide entre « envoyer » et « surtout pas », et une erreur ici se paie
 * soit d'un email perdu, soit d'un email en double.
 */

export const TENTATIVES_MAX = 3;

/**
 * Une ligne `en_cours` depuis plus d'une heure, c'est une exécution morte
 * entre la réservation et la réponse du prestataire. On la reprend, avec la
 * même clé d'idempotence : Resend la garde vingt-quatre heures, et la tâche
 * horaire repasse bien avant. Si l'email était parti, Resend ne le renvoie pas.
 */
export const EN_COURS_ABANDONNE_MS = 60 * 60 * 1000;

export type LigneRegistre = {
  statut: string;
  tentatives: number;
  updated_at: string;
};

export function peutReprendre(ligne: LigneRegistre, maintenant = new Date()): boolean {
  if (ligne.tentatives >= TENTATIVES_MAX) return false;
  if (ligne.statut === 'echec') return true;
  if (ligne.statut === 'en_cours') {
    return maintenant.getTime() - new Date(ligne.updated_at).getTime() > EN_COURS_ABANDONNE_MS;
  }
  // `envoye`, `livre`, et toute valeur inconnue : on ne renvoie jamais.
  //
  // **`rebond` et `plainte` tombent ici, et c'est voulu.** Ce sont les deux
  // états que le webhook pose (`lib/email/rebonds.ts`), et les retenter est
  // précisément ce qu'il ne faut pas faire : relancer trois fois une adresse
  // qui n'existe pas, ou quelqu'un qui vient de nous signaler comme
  // indésirables, abîme la réputation du domaine expéditeur — donc la
  // délivrabilité de tous les autres emails, y compris les liens de connexion.
  return false;
}

/** La clé d'idempotence transmise au prestataire : une par email, stable entre tentatives. */
export const cleIdempotence = (modele: string, cle: string) => `${modele}:${cle}`;
