/**
 * Les emails transactionnels, en fonctions pures.
 *
 * Rien ici ne lit la base ni n'envoie quoi que ce soit : un modèle reçoit ce
 * qu'il affirme, déjà vérifié par la tâche qui l'appelle, et rend un sujet, un
 * HTML et un texte brut. C'est ce qui permet de les tester, et de les montrer
 * dans le back-office sur des données d'exemple.
 *
 * **Un email n'affirme que ce que la base a établi.** « Paiement reçu » ne part
 * que pour une commande `payee` ; la date de fin d'accès est celle de
 * l'inscription, pas une durée recalculée. C'est la règle des messages du site,
 * appliquée à la boîte mail.
 *
 * Vouvoiement, comme tout le site. Pas d'image distante — beaucoup de
 * messageries les bloquent, et un email qui ne se lit qu'avec ses images ne se
 * lit pas.
 */

import { SOCIETE } from '../legal/societe.ts';

export type Email = { sujet: string; html: string; texte: string };

export type TypeProduit = 'abonnement' | 'accompagnement' | 'formation';

const NOM = 'ApexCompany';

// Le vendeur en pied de chaque email. Chemin relatif et extension explicite :
// ce fichier est exécuté tel quel par le runner de tests de Node, qui ne
// résout pas l'alias `@/`.
const VENDEUR = `${SOCIETE.raisonSociale}, ${SOCIETE.adresse}`;
const EMAIL_VENDEUR = SOCIETE.email;

export function echapper(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const euros = (cents: number, devise = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise })
    .format(cents / 100)
    .replace(/[  ]/g, ' ');

/** Une date `AAAA-MM-JJ` ou ISO, en toutes lettres, à Paris. */
export function dateLongue(valeur: string): string {
  const instant = /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? `${valeur}T12:00:00Z` : valeur;
  return new Date(instant).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const bonjour = (prenom: string | null) => (prenom ? `Bonjour ${prenom},` : 'Bonjour,');

/**
 * La mise en page commune : une colonne, un bouton, une signature. Les styles
 * sont en ligne parce que la plupart des messageries ignorent les feuilles de
 * style.
 */
function composer({
  sujet,
  prenom,
  paragraphes,
  bouton,
  apres = [],
}: {
  sujet: string;
  prenom: string | null;
  paragraphes: string[];
  bouton: { libelle: string; lien: string };
  apres?: string[];
}): Email {
  const p = (t: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1f2937">${echapper(t)}</p>`;

  const html = `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:24px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px">
<tr><td style="padding:32px">
<p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:#111827">${NOM}</p>
${p(bonjour(prenom))}
${paragraphes.map(p).join('\n')}
<p style="margin:24px 0"><a href="${echapper(bouton.lien)}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">${echapper(bouton.libelle)}</a></p>
${apres.map(p).join('\n')}
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b7280">L’équipe ${NOM}<br>Cet email vous est envoyé parce que vous avez un compte sur notre site.<br>${echapper(VENDEUR)}</p>
</td></tr>
</table>
</body>
</html>`;

  const texte = [
    bonjour(prenom),
    '',
    ...paragraphes.flatMap((t) => [t, '']),
    `${bouton.libelle} : ${bouton.lien}`,
    '',
    ...apres.flatMap((t) => [t, '']),
    `L’équipe ${NOM}`,
    VENDEUR,
  ].join('\n');

  return { sujet, html, texte };
}

const descriptionAcces = (type: TypeProduit, dateFin: string | null) => {
  if (type === 'abonnement') {
    return dateFin
      ? `Votre abonnement court jusqu’au ${dateLongue(dateFin)} et se renouvelle chaque mois. Vous pouvez le résilier à tout moment depuis votre espace.`
      : 'Votre abonnement se renouvelle chaque mois. Vous pouvez le résilier à tout moment depuis votre espace.';
  }
  if (dateFin) return `Votre accès est ouvert jusqu’au ${dateLongue(dateFin)}.`;
  return 'Votre accès est ouvert, sans date de fin.';
};

/**
 * La confirmation écrite de la demande de démarrage immédiat.
 *
 * Le consommateur qui renonce à sa rétractation, ou qui fait commencer un
 * service avant la fin du délai, doit en recevoir la confirmation sur un
 * support durable — cet email, le seul qui part à l'achat et une seule fois
 * (`tache.ts` le clé sur la commande). Même règle que l'article 8 des CGV :
 * elle dépend du type de produit.
 */
export function rappelRetractation(type: TypeProduit): string {
  return type !== 'accompagnement'
    ? 'Comme vous l’avez demandé en commandant, votre accès a été ouvert immédiatement. Vous avez reconnu perdre ainsi votre droit de rétractation (article 8 de nos conditions générales de vente).'
    : `Comme vous l’avez demandé en commandant, votre accès a commencé immédiatement. Vous pouvez encore vous rétracter dans les quatorze jours suivant votre paiement, en écrivant à ${EMAIL_VENDEUR} ; la part correspondant à la période écoulée reste alors due (article 8 de nos conditions générales de vente).`;
}

export function paiementRecu(d: {
  prenom: string | null;
  produit: string;
  montantCents: number;
  devise?: string;
  typeProduit: TypeProduit;
  dateFinAcces: string | null;
  lienEspace: string;
}): Email {
  return composer({
    sujet: `Paiement reçu — ${d.produit}`,
    prenom: d.prenom,
    paragraphes: [
      `Nous avons bien reçu votre paiement de ${euros(d.montantCents, d.devise)} pour « ${d.produit} ».`,
      descriptionAcces(d.typeProduit, d.dateFinAcces),
      'Votre accès sur Discord est attribué automatiquement dans les minutes qui suivent, à condition que votre compte Discord soit connecté depuis votre espace.',
    ],
    bouton: { libelle: 'Accéder à mon espace', lien: d.lienEspace },
    apres: [
      'Votre facture est disponible dans votre espace, rubrique Factures.',
      rappelRetractation(d.typeProduit),
    ],
  });
}

export function propositionRecue(d: {
  prenom: string | null;
  produit: string;
  montantCents: number;
  devise?: string;
  typeProduit: TypeProduit;
  expireLe: string | null;
  lien: string;
}): Email {
  const prix =
    d.typeProduit === 'abonnement'
      ? `${euros(d.montantCents, d.devise)} par mois`
      : euros(d.montantCents, d.devise);
  return composer({
    sujet: `Votre proposition — ${d.produit}`,
    prenom: d.prenom,
    paragraphes: [
      `Suite à notre échange, voici la proposition que nous vous avons préparée : « ${d.produit} », pour ${prix}.`,
      d.expireLe
        ? `Elle est valable jusqu’au ${dateLongue(d.expireLe)}. Vous pouvez la consulter et la régler en ligne depuis votre espace.`
        : 'Vous pouvez la consulter et la régler en ligne depuis votre espace.',
    ],
    bouton: { libelle: 'Voir ma proposition', lien: d.lien },
    apres: ['Une question avant de vous décider ? Répondez simplement à cet email.'],
  });
}

export function relanceDiscord(d: { prenom: string | null; produit: string; lien: string }): Email {
  return composer({
    sujet: 'Dernière étape pour accéder à votre programme',
    prenom: d.prenom,
    paragraphes: [
      `Votre accès à « ${d.produit} » est ouvert, mais votre compte Discord n’est pas encore connecté à votre espace.`,
      'Tout le programme se déroule sur Discord : sans cette connexion, nous ne pouvons pas vous y ouvrir les salons. Cela prend moins d’une minute.',
    ],
    bouton: { libelle: 'Connecter mon compte Discord', lien: d.lien },
  });
}

export function finAccesProche(d: {
  prenom: string | null;
  produit: string;
  dateFin: string;
  lien: string;
}): Email {
  return composer({
    sujet: `Votre accès à ${d.produit} se termine le ${dateLongue(d.dateFin)}`,
    prenom: d.prenom,
    paragraphes: [
      `Votre accès à « ${d.produit} » se termine le ${dateLongue(d.dateFin)}. Après cette date, les salons Discord du programme ne vous seront plus ouverts.`,
      'Si vous souhaitez poursuivre, parlez-en à votre formateur : il peut vous proposer la suite adaptée à où vous en êtes.',
    ],
    bouton: { libelle: 'Accéder à mon espace', lien: d.lien },
  });
}
