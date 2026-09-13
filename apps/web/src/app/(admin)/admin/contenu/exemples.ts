import type { TemoignageAffiche } from '@/components/temoignages';

/**
 * Les exemples montrés au client dans le guide de contenu.
 *
 * **Ils sont fictifs, et ne quittent jamais le back-office.** Ils ne sont pas
 * en base, ne peuvent pas être publiés, et aucune page publique ne les importe.
 * C'est délibéré : le dépôt pose partout qu'inventer du contenu sur un site de
 * formation à l'investissement est un risque, pas un espace réservé. Un exemple
 * qui sert à expliquer ce qu'on attend n'est pas du contenu qu'on affiche.
 *
 * Chaque nom porte « (exemple) » — si une capture d'écran de cette page
 * circule, personne ne peut la prendre pour le site.
 *
 * Ils sont écrits pour montrer ce qui distingue un bon témoignage : un fait
 * précis plutôt qu'un superlatif, un avant et un après, et **aucune promesse de
 * gain** — c'est ce dernier point qui rend les autres publiables.
 */
export const TEMOIGNAGES_EXEMPLE: TemoignageAffiche[] = [
  {
    id: 'exemple-1',
    auteur: 'Chloé D. (exemple)',
    contexte: 'Accompagnement 3 mois',
    contenu:
      'Je passais mes soirées à chercher des signaux et je changeais de méthode toutes les deux semaines. Le suivi m’a surtout appris à écrire mon plan avant d’ouvrir une position, et à le relire après. Je prends beaucoup moins de trades, et je sais enfin dire pourquoi je les prends.',
    note: 5,
  },
  {
    id: 'exemple-2',
    auteur: 'Marc T. (exemple)',
    contexte: 'Abonnement communauté',
    contenu:
      'Ce que je viens chercher, c’est le cadre : les sessions du mardi m’obligent à préparer ma semaine. Les échanges dans le salon valent autant que les cours — on y voit les erreurs des autres avant de les faire soi-même.',
    note: 4,
  },
  {
    id: 'exemple-3',
    auteur: 'Inès B. (exemple)',
    contexte: 'Formation, débutante',
    contenu:
      'Je partais de zéro et je craignais de me retrouver larguée. Les modules sont courts et on refait les exercices autant de fois qu’on veut. Trois mois après, je comprends ce que je lis sur un graphique — ce qui n’était pas gagné.',
    note: 5,
  },
];

export type FicheExemple = {
  nom: string;
  fonction: string;
  biographie: string;
  specialites: string[];
};

/**
 * Deux fiches, choisies pour montrer deux longueurs acceptables et deux rôles
 * différents. La biographie répond à une seule question — « à qui vais-je avoir
 * affaire ? » — et se garde de toute promesse de résultat.
 */
export const FICHES_EXEMPLE: FicheExemple[] = [
  {
    nom: 'Prénom Nom (exemple)',
    fonction: 'Directeur de l’accompagnement',
    biographie:
      'Je mène tous les échanges d’orientation, et c’est moi qui décide avec vous si un programme correspond — ou s’il vaut mieux attendre. J’ai commencé par me former seul pendant deux ans, avec les erreurs que ça suppose, avant de structurer une méthode et de l’enseigner. Ce que j’aime faire : reprendre un plan de trading ligne par ligne jusqu’à ce qu’il tienne sans moi.',
    specialites: ['psychologie de l’exécution', 'gestion du risque'],
  },
  {
    nom: 'Prénom Nom (exemple)',
    fonction: 'Formatrice technique',
    biographie:
      'J’interviens sur l’analyse et la construction des plans. J’encadre les sessions de groupe du mardi et je reprends les comptes rendus individuels.',
    specialites: ['analyse technique', 'suivi individuel'],
  },
];
