import { alerte, info, succes, type Message } from './types';
import type { EtatCompte, EtatDiscord, EtatPaiement, Preuve } from './preuves';

/**
 * Le catalogue des messages portés par l'URL.
 *
 * **Un seul paramètre pour tout le site : `?m=<code>`.** Avant, quatre
 * conventions coexistaient — `?discord=`, `?paiement=`, `?verifier=`,
 * `?inscription=` — et la quatrième était morte : `/qualification` redirigeait
 * vers `/reserver?inscription=ok`, que `/reserver` n'a jamais lu. Le seul retour
 * du tunnel qui dit « ton compte est créé » tombait dans le vide.
 *
 * **Un code inconnu ne rend rien, et le contenu de l'URL n'est jamais affiché.**
 * Le paramètre sert d'index dans ce fichier, pas de source de texte.
 *
 * **Les codes sont au passé.** `paiement-annule`, `compte-cree`, `discord-lie`.
 * Un code comme `acces-en-cours` — une affirmation au présent — est exactement
 * ce qui ne doit pas exister : l'URL parle d'un événement, la base parle de
 * l'état.
 *
 * ── Les deux familles ───────────────────────────────────────────────────────
 *
 * Le test qui les sépare : *si un inconnu tape cette URL sur une page où rien ne
 * s'est passé, ce qu'il lit est-il encore vrai ?*
 *
 * **Constantes** — oui. « Paiement interrompu, rien n'a été débité » reste vrai
 * pour qui n'a jamais rien payé. Ces messages sont de simples valeurs.
 *
 * **Dépendants** — non. Ils affirment quelque chose sur le compte, et se
 * construisent à partir d'une `Preuve` lue en base (`preuves.ts`). Ils ont le
 * droit de ne rien renvoyer : c'est même leur comportement par défaut, et c'est
 * ce qui referme le cas de l'URL saisie à la main. Une preuve absente ne donne
 * pas un message dégradé — elle ne donne pas de message.
 */

export const PARAM = 'm';

/** Vraies même forgées. */
const CONSTANTES: Record<string, Message> = {
  'paiement-annule': info('Paiement interrompu — rien n’a été débité.'),
  // `alerte`, pas `info` : c'est un échec, et le ton décide du rôle ARIA. En
  // `info` il s'affichait en gris et n'était annoncé que poliment, alors que la
  // liaison — sans laquelle aucun accès n'arrive — vient d'échouer.
  'discord-echec': alerte('La connexion à Discord n’a pas abouti. Réessaie, rien n’a été perdu.'),
  // « Rien n'a changé » reste vrai même forgé, y compris pour qui n'a jamais
  // rien lié : c'est ce qui autorise cette phrase dans une constante.
  'discord-annule': info('Connexion à Discord annulée. Rien n’a changé.'),
};

/**
 * Un message dont rien n'a besoin d'être vérifié — utilisable tel quel par une
 * page qui n'a que des codes constants à rendre.
 */
export const messageConstant = (code: string | undefined): Message | null =>
  code ? (CONSTANTES[code] ?? null) : null;

const constante = messageConstant;

/**
 * Les messages de `/espace/communaute`.
 *
 * **Un seul code, deux issues.** La première version du système en avait deux
 * — `discord-lie` et `discord-sans-role` — et la route choisissait. C'était une
 * divergence de plus : elle parlait d'un instant que la page relit une seconde
 * après. C'est `roleEnFile` qui tranche désormais, et la route ne dit plus que
 * ce qu'elle sait, à savoir qu'une liaison vient d'avoir lieu.
 *
 * **Les deux phrases partagent la même prémisse** — « ton compte Discord est
 * connecté » — et c'est ce qui manquait à la première version : on ne vérifiait
 * que la subordonnée (« ton accès arrive »), si bien que l'URL forgée basculait
 * simplement sur l'autre branche et mentait quand même, un cran plus bas.
 * `lieRecemment` garde la principale ; sans elle, aucune des deux ne s'affiche.
 */
export function messageDiscord(
  code: string | undefined,
  preuve: Preuve<EtatDiscord>,
): Message | null {
  if (code === 'discord-lie') {
    if (!preuve.lieRecemment) return null;

    return preuve.roleEnFile
      ? succes('Ton compte Discord est connecté. Ton accès arrive dans la minute.')
      : alerte(
          'Ton compte Discord est connecté, mais ton accès n’a pas pu être demandé. L’équipe est prévenue — inutile de réessayer.',
        );
  }

  return constante(code);
}

/**
 * Les messages de retour de paiement.
 *
 * Un seul code dépendant, et c'est celui qui compte le plus du catalogue :
 * annoncer « paiement reçu » à qui n'a rien payé l'envoie attendre un accès que
 * personne n'a demandé.
 *
 * Noter que `roleEnFile` n'entre pas ici : l'ouverture de l'accès est faite par
 * `traiter_paiement()` dans la même transaction que l'encaissement. Si la
 * commande est `payee`, le `grant` est empilé — c'est l'invariant de la
 * fonction, pas une supposition de cet écran.
 */
export function messagePaiement(
  code: string | undefined,
  preuve: Preuve<EtatPaiement>,
): Message | null {
  if (code === 'paiement-recu') {
    return preuve.paiementRecent
      ? succes('Paiement reçu. Ton accès s’ouvre sur Discord dans la minute qui suit.')
      : null;
  }

  return constante(code);
}

/**
 * Les erreurs du fournisseur d'identité, qui arrivent dans le **fragment**.
 *
 * `#error=server_error&error_code=identity_already_exists` : Supabase range
 * l'échec derrière un `#`, et un fragment n'est **jamais envoyé au serveur**.
 * Notre route de rappel ne voit donc ni `code` ni erreur, et concluait « pas de
 * code, donc la personne a annulé » — alors que Discord venait de refuser pour
 * une raison précise et actionnable. Seul le navigateur peut lire ça, d'où la
 * lecture côté client dans `MessageURL`.
 *
 * **Ce sont des constantes**, et elles passent le test : forgées, elles ne
 * disent rien de faux sur le compte de qui les lit. Elles décrivent une
 * tentative de liaison — comme `paiement-annule` décrit une tentative de
 * paiement —, pas un état du compte. Sans tentative, la phrase est vide, pas
 * mensongère.
 */
const FOURNISSEUR: Record<string, Message> = {
  identity_already_exists: alerte(
    'Ce compte Discord est déjà relié à un autre compte du site. Relie un autre compte Discord, ou écris-nous pour détacher l’ancien.',
  ),
  access_denied: info('Connexion à Discord annulée. Rien n’a changé.'),
};

export function messageFournisseur(
  codeErreur: string | null,
  erreur: string | null,
): Message | null {
  if (codeErreur && FOURNISSEUR[codeErreur]) return FOURNISSEUR[codeErreur];

  // Une erreur qu'on n'a pas prévue reste une erreur : on ne la fait pas passer
  // pour une annulation, et on n'affiche pas son texte — il vient de Discord,
  // il est en anglais et il parle de leur implémentation.
  return erreur || codeErreur
    ? alerte('La connexion à Discord n’a pas abouti. Réessaie, rien n’a été perdu.')
    : null;
}

/** Le retour du tunnel de qualification, sur `/reserver`. */
export function messageCompte(
  code: string | undefined,
  preuve: Preuve<EtatCompte>,
): Message | null {
  if (code === 'compte-cree') {
    return preuve.compteCreeRecemment
      ? succes('Ton compte est créé. Choisis maintenant le créneau de ton audit.')
      : null;
  }

  return constante(code);
}
