/**
 * Un CSV que le comptable ouvre d'un double clic.
 *
 * Trois choix, tous dictés par Excel en français plutôt que par la norme :
 * - **le point-virgule** comme séparateur : la virgule y est le séparateur
 *   décimal, et un fichier à virgules s'ouvre en une seule colonne ;
 * - **l'indicateur d'ordre des octets** (BOM) en tête : sans lui, Excel lit
 *   l'UTF-8 comme du Windows-1252 et « Accélérateur » devient illisible ;
 * - **les montants en euros, virgule décimale** : un montant en centimes
 *   oblige le comptable à diviser, et c'est l'erreur qu'il ne verra pas.
 *
 * Aucune dépendance : ce fichier ne lit rien, il met en forme. C'est ce qui le
 * rend testable sans base.
 */

export type Cellule = string | number | null | undefined;

const BOM = '﻿';
const SEPARATEUR = ';';

/**
 * Une cellule protégée : guillemets doublés, et entourée de guillemets dès
 * qu'elle contient un séparateur, un guillemet ou un saut de ligne.
 *
 * **Et neutralisée si elle commence par `=`, `+`, `-` ou `@`.** Un tableur
 * exécute ces cellules comme des formules : un prospect qui s'appellerait
 * `=HYPERLINK(...)` piégerait le poste de qui ouvre l'export. L'apostrophe en
 * tête est la parade reconnue ; elle ne s'affiche pas.
 */
export function cellule(valeur: Cellule): string {
  if (valeur === null || valeur === undefined) return '';
  let texte = String(valeur);
  // Un nombre écrit en texte (« -10,00 ») ou un téléphone (« +33 6… ») n'est pas
  // une formule : il reste tel quel, l'apostrophe le rendrait illisible.
  const formule =
    /^[=+\-@\t\r]/.test(texte) && !/^-?\d[\d\s]*(,\d+)?$/.test(texte) && !/^\+[\d\s]+$/.test(texte);
  if (typeof valeur === 'string' && formule) texte = `'${texte}`;
  return /[";\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

/** Un montant en centimes, écrit en euros avec une virgule : `2490,00`. */
export const montant = (cents: number | null | undefined): string =>
  cents === null || cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ',');

/** Une date ISO en `JJ/MM/AAAA`, à l'heure de Paris. */
export function date(iso: string | null | undefined): string {
  if (!iso) return '';
  // Une date seule (« 2026-09-17 ») n'a pas de fuseau : la convertir la ferait
  // glisser d'un jour selon l'heure du serveur.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.split('-').reverse().join('/');
  return new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
}

export function versCsv(entetes: readonly string[], lignes: readonly Cellule[][]): string {
  const rangs = [entetes, ...lignes].map((l) => l.map(cellule).join(SEPARATEUR));
  // CRLF : la fin de ligne qu'attend Excel sous Windows.
  return BOM + rangs.join('\r\n') + '\r\n';
}
