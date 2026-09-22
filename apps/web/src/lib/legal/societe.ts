/**
 * L'identité de la société qui vend, en un seul endroit.
 *
 * Source : les pages légales de l'ancien site (apexcompany.com, mises à jour le
 * 4 mai 2026), transmises le 21 septembre 2026. Elles tranchent la question qui
 * bloquait tout depuis le 8 septembre : **c'est APEX COMPANY L.L.C-FZ qui vend
 * aux clients finaux** et émet les factures — NEURO TRADE APEX LLC, citée dans
 * le contrat de prestation, n'apparaît nulle part côté client.
 *
 * Mentions légales, CGV, confidentialité et données structurées lisent tout
 * ici : une adresse recopiée en quatre endroits en devient quatre le jour où
 * elle change.
 *
 * **La licence expire le 19 février 2027.** Une licence de zone franche non
 * renouvelée, c'est une société qui ne peut plus vendre — et des mentions
 * légales qui affichent un numéro caduc. À rappeler au client en janvier.
 */
export const SOCIETE = {
  raisonSociale: 'APEX COMPANY L.L.C-FZ',
  nomCommercial: 'Apex Company',
  forme:
    'société à responsabilité limitée de zone franche (Free Zone Limited Liability Company), de droit des Émirats arabes unis',
  zoneFranche: 'Meydan Free Zone, Dubaï',
  adresse: 'Meydan Grandstand, 6th Floor, Meydan Road, Nad Al Sheba, Dubaï, Émirats arabes unis',
  licence: '2645781.01',
  immatriculation: '2645781',
  /** Numéro d'enregistrement à la TVA émiratie (Tax Registration Number). */
  trn: '105376842800001',
  licenceEmiseLe: '20 février 2026',
  licenceExpireLe: '19 février 2027',
  dirigeant: 'Franck Alexandre',
  telephone: '+971 52 745 3336',
  /**
   * L'adresse que les textes légaux de l'ancien site donnent pour tout :
   * rétractation, remboursement, exercice des droits. Elle existe et elle est
   * relevée — ce que `EMAIL_CONTACT` (`lib/contact.ts`) n'a toujours pas
   * confirmé. Les demandes qui ont une valeur juridique vont donc ici.
   */
  email: 'payment@apexcompany.com',
} as const;

/**
 * L'hébergeur du site, que les mentions légales doivent nommer.
 *
 * **Vercel est recommandé, pas encore souscrit** (`CLAUDE.md`, hébergement,
 * 16 septembre). L'ancien site nommait Netlify. Si le client en choisit un
 * autre, c'est cette constante qui change, et rien d'autre.
 */
export const HEBERGEUR_SITE = {
  nom: 'Vercel Inc.',
  adresse: '440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis',
  site: 'https://vercel.com',
} as const;

export const HEBERGEUR_DONNEES = {
  nom: 'Supabase, Inc.',
  adresse: '970 Toa Payoh North #07-04, Singapour 318992',
  site: 'https://supabase.com',
} as const;

/**
 * La date affichée en tête des textes, et la version enregistrée avec chaque
 * acceptation (`lib/legal/acceptation.ts`).
 *
 * **Toute modification des CGV ou de l'avertissement sur les risques change
 * cette date.** C'est elle qui permet de retrouver, pour une vente donnée, le
 * texte que le client a réellement accepté — git garde les versions, la base
 * garde laquelle s'appliquait.
 */
export const VERSION_TEXTES_LEGAUX = '2026-09-22';
export const MISE_A_JOUR_LISIBLE = '22 septembre 2026';
