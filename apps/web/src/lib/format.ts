const FUSEAU = 'Europe/Paris';

/**
 * Formats de date de l'application.
 *
 * Fixer le fuseau est nécessaire, pas décoratif : le rendu a lieu sur le
 * serveur, dont l'horloge n'est pas celle de l'équipe. Sans ce réglage, un
 * rendez-vous de 9 h affiché depuis un serveur en UTC devient 8 h, et le
 * tableau de bord se met à mentir d'une heure une partie de l'année.
 *
 * Le formulaire accepte cinq zones géographiques, mais ces écrans-là sont ceux
 * de l'équipe : c'est son heure locale qui fait référence.
 */

export function dateHeure(valeur: string | null | undefined): string {
  if (!valeur) return '—';
  return new Date(valeur).toLocaleString('fr-FR', {
    timeZone: FUSEAU,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function heure(valeur: string | null | undefined): string {
  if (!valeur) return '—';
  return new Date(valeur).toLocaleTimeString('fr-FR', {
    timeZone: FUSEAU,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function dateCourte(valeur: string | null | undefined): string {
  if (!valeur) return '—';
  return new Date(valeur).toLocaleDateString('fr-FR', { timeZone: FUSEAU, dateStyle: 'medium' });
}

/** Écart entre l'heure de Paris et UTC à cet instant, en millisecondes. */
function decalageParis(instant: Date): number {
  const lu = (timeZone: string) =>
    new Date(instant.toLocaleString('en-US', { timeZone })).getTime();
  return lu(FUSEAU) - lu('UTC');
}

/**
 * Bornes du jour courant **à Paris**, pour « mes rendez-vous d'aujourd'hui ».
 *
 * `setHours(0)` prendrait minuit à l'heure du serveur : en UTC, le « jour »
 * commencerait à 1 h ou 2 h du matin, et un audit de 0 h 30 tomberait dans la
 * veille. Changement d'heure compris, puisque le décalage est relu pour chaque
 * borne.
 */
export function bornesDuJour(maintenant = new Date()): { debut: string; fin: string } {
  const jour = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU }).format(maintenant);
  const minuit = (iso: string) => {
    const utc = new Date(`${iso}T00:00:00Z`);
    return new Date(utc.getTime() - decalageParis(utc));
  };
  const lendemain = new Date(`${jour}T12:00:00Z`);
  lendemain.setUTCDate(lendemain.getUTCDate() + 1);

  return {
    debut: minuit(jour).toISOString(),
    fin: minuit(lendemain.toISOString().slice(0, 10)).toISOString(),
  };
}
