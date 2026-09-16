import 'server-only';

import { isIP } from 'node:net';
import { headers } from 'next/headers';

/**
 * L'adresse IP à l'origine de la requête, ou `null` si elle n'est pas
 * connaissable.
 *
 * Sert à renseigner `consents.ip`, prévue depuis le 7 septembre et restée vide
 * jusqu'au 16. Une preuve de consentement se juge sur ce qu'elle permet de
 * reconstituer — qui, quand, à quoi, depuis où — et c'est le dernier point
 * qu'on nous demandera le jour où quelqu'un affirme n'avoir jamais accepté.
 *
 * **`null` est une réponse acceptable, et c'est le cœur du fichier.** Quand
 * l'adresse n'est pas connaissable ou qu'elle est illisible, on écrit `null`
 * plutôt qu'une valeur de repli. Une preuve qui ment est pire qu'une preuve
 * absente — même règle que les chiffres de l'accueil, qui ne s'affichent pas
 * sans source, et que les indicateurs de `/admin/aide`, qui se lisent en base
 * au lieu d'être affirmés.
 *
 * **En développement, attendez-vous à `::1`, et c'est correct.** Le serveur de
 * dev de Next pose lui-même `x-forwarded-for` à l'adresse de bouclage —
 * constaté le 16 septembre en faisant passer de vrais en-têtes à cette
 * fonction, alors que ce commentaire annonçait `null`. `::1` est l'adresse
 * réelle de la connexion : la consigner n'est pas inventer, c'est enregistrer
 * que la personne venait de la machine elle-même.
 *
 * **La colonne est de type `inet`.** PostgreSQL rejette une valeur qu'il ne
 * sait pas lire, et ce rejet ferait échouer l'`insert` du consentement tout
 * entier : un en-tête mal formé — ou forgé — coûterait le consentement, pas
 * seulement l'adresse. D'où la validation par `isIP()` avant de rendre quoi
 * que ce soit, et `null` dans tous les cas douteux.
 *
 * **Ce que cette adresse vaut dépend de l'hébergeur**, qui n'est pas encore
 * choisi (`docs/08-CE-QUI-MANQUE.md`). `x-forwarded-for` est un en-tête de
 * requête : n'importe qui peut l'envoyer. Il ne devient une preuve que si
 * l'hébergeur l'écrase par l'adresse réelle de la connexion, ce que font les
 * plateformes courantes. À revérifier le jour où l'hébergement est tranché :
 * si le site est servi sans proxy de confiance devant, cette valeur est
 * déclarative et il faudra le dire au juriste plutôt que la présenter comme
 * une preuve.
 */
export async function ipDeLaRequete(): Promise<string | null> {
  const enTetes = await headers();

  // `x-forwarded-for` est une liste : « client, proxy1, proxy2 ». Le client
  // est en tête, les proxys s'ajoutent à la suite au fil des sauts.
  const chaine = enTetes.get('x-forwarded-for') ?? enTetes.get('x-real-ip');
  if (!chaine) return null;

  const premiere = chaine.split(',')[0]?.trim();
  if (!premiere) return null;

  return normaliser(premiere);
}

/**
 * Ramène une valeur d'en-tête à une adresse que `inet` accepte, ou à `null`.
 *
 * Deux formes traînent en plus de l'adresse nue, selon le proxy traversé :
 * `1.2.3.4:5678` et `[2001:db8::1]:443`. Le port ne nous intéresse pas et
 * ferait échouer la conversion.
 */
function normaliser(valeur: string): string | null {
  let adresse = valeur;

  // [IPv6]:port — les crochets ne sont là que pour isoler le port.
  const entreCrochets = adresse.match(/^\[(.+)\](?::\d+)?$/);
  if (entreCrochets) {
    adresse = entreCrochets[1];
  } else if (adresse.includes(':') && !adresse.includes('::')) {
    // Un seul « : » et pas de forme abrégée IPv6 : c'est un IPv4 avec port.
    // Une IPv6 complète en contient plusieurs, on n'y touche pas.
    const morceaux = adresse.split(':');
    if (morceaux.length === 2) adresse = morceaux[0];
  }

  return isIP(adresse) === 0 ? null : adresse;
}
