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

/** Bornes du jour courant, pour « mes rendez-vous d'aujourd'hui ». */
export function bornesDuJour(): { debut: string; fin: string } {
  const maintenant = new Date();
  const debut = new Date(maintenant);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);

  return { debut: debut.toISOString(), fin: fin.toISOString() };
}
