/**
 * Les comptes publics de la marque, à un seul endroit.
 *
 * Même principe que `lib/legal/societe.ts` : une identité qui s'affiche à
 * plusieurs endroits — pied de page, données structurées, et demain un email —
 * se déclare une fois. Recopiée, elle finit par diverger, et c'est l'adresse
 * périmée qu'on découvre le jour où quelqu'un clique.
 *
 * **Le compte s'appelle `neurotradeapex` sur les trois réseaux**, pas
 * « ApexCompany ». Ce n'est pas une faute de frappe : c'est le nom sous lequel
 * la marque existe déjà auprès de son audience. Le site garde le sien.
 *
 * **Le serveur Discord est le seul à ne pas être une vitrine** : c'est là que
 * l'accès payé s'ouvre. Le lien d'invitation était réclamé au client depuis le
 * 13 septembre (`docs/08-CE-QUI-MANQUE.md`) — sans lui, une relance vers
 * quelqu'un qui a lié son compte sans rejoindre le serveur ne savait pas où
 * l'envoyer.
 */

export type Reseau = {
  id: 'youtube' | 'instagram' | 'tiktok' | 'discord';
  nom: string;
  url: string;
};

export const RESEAUX: readonly Reseau[] = [
  { id: 'youtube', nom: 'YouTube', url: 'https://www.youtube.com/@neurotradeapex' },
  { id: 'instagram', nom: 'Instagram', url: 'https://www.instagram.com/neurotradeapex_/' },
  { id: 'tiktok', nom: 'TikTok', url: 'https://www.tiktok.com/@neurotradeapex' },
  { id: 'discord', nom: 'Discord', url: 'https://discord.gg/jZyMJrBQut' },
] as const;

/**
 * L'invitation au serveur Discord.
 *
 * Exportée à part parce qu'elle ne sert pas au même usage que les trois
 * autres : celles-là sont des vitrines, celle-ci est une porte. Elle est
 * attendue par l'email de relance « compte lié, membre jamais arrivé sur le
 * serveur », qui reste à écrire.
 */
export const INVITATION_DISCORD = RESEAUX.find((r) => r.id === 'discord')!.url;

/**
 * Les mêmes adresses pour les moteurs de recherche.
 *
 * `sameAs` est ce qui dit à Google que ces comptes et ce site sont la **même
 * entité**. Sans lui, la marque existe en quatre endroits qui ne se
 * reconnaissent pas entre eux, et la notoriété des réseaux — qui est réelle,
 * c'est le canal d'acquisition — ne profite pas au site.
 */
export const SAME_AS = RESEAUX.map((r) => r.url);
