/**
 * L'adresse publique du site, en un seul endroit.
 *
 * Le nom de domaine n'est pas encore arrêté (`docs/08-CE-QUI-MANQUE.md`) : tant
 * qu'il ne l'est pas, `NEXT_PUBLIC_SITE_URL` reste sur localhost, et le site ne
 * doit surtout pas être référencé. C'est `siteIndexable` qui porte cette
 * conséquence, et `robots.ts` qui l'applique.
 */
const DEFAUT = 'http://localhost:3000';

/**
 * Sans barre oblique finale : une variable renseignée « https://site.fr/ »
 * produirait sinon des URL en `//formations`, que les moteurs comptent comme
 * une adresse distincte de `/formations`.
 *
 * `||` et non `??` : une variable présente mais vide — le cas exact de
 * `.env.example` — doit retomber sur la valeur par défaut, pas donner `''`.
 */
export const urlSite = (process.env.NEXT_PUBLIC_SITE_URL || DEFAUT).replace(/\/+$/, '');

/**
 * Un déploiement ne s'ouvre aux moteurs que s'il est servi en HTTPS depuis un
 * vrai domaine. Sinon `robots.ts` interdit tout, et c'est délibéré : une
 * préproduction indexée capte le référencement du vrai site, puis met des
 * semaines à se désindexer.
 *
 * Ce garde-fou couvre le cas courant — localhost, et une préproduction dont on
 * a oublié de renseigner la variable. Il ne couvre pas une préproduction qui
 * hériterait de la variable de production : là, c'est à l'hébergeur d'y
 * répondre, en surchargeant `NEXT_PUBLIC_SITE_URL` ou par un en-tête
 * `X-Robots-Tag`. À vérifier quand l'hébergement sera tranché.
 */
export const siteIndexable = urlSite.startsWith('https://');
