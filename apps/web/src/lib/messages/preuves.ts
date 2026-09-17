import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Les preuves — ce sans quoi un message ne peut rien affirmer.
 *
 * **Le problème que ce fichier existe pour régler.** Un paramètre d'URL est une
 * chaîne que n'importe qui tape à la main. `/espace/communaute?discord=ok`
 * répondait « Ton compte Discord est connecté, ton accès arrive dans la minute »
 * à quelqu'un qui n'avait jamais rien connecté — et le même lien, remis en
 * favori, le répétait un mois plus tard. La règle qu'on s'est donnée :
 *
 *   **une URL transporte un accent, jamais une proposition.**
 *   Ce qui est affirmé vient des données que la page a chargées.
 *
 * Le test à appliquer à chaque code : *si un inconnu tape cette URL sur une page
 * où rien ne s'est passé, ce qu'il lit est-il encore vrai ?* Si non, le code est
 * dépendant et son message se construit ici, à partir d'une preuve.
 *
 * **Deux garde-fous, et le second est le vrai.**
 *
 * 1. `Preuve<T>` est un type marqué : seules les fonctions de ce fichier
 *    peuvent en fabriquer une. Un `preuve={{ lieRecemment: true }}` écrit à la
 *    main ne compile pas. Ce n'est pas l'inconnu qui forge une URL qu'on arrête
 *    par là — c'est le développeur pressé, qui est le cas fréquent.
 * 2. **Chaque preuve est bornée dans le temps.** L'URL dit qu'un événement a eu
 *    lieu ; la base dit qu'un tel événement a eu lieu *récemment, pour ce
 *    compte*. Il faut les deux. C'est ce qui rend « ce qui vient de se passer »
 *    vérifiable au lieu d'être une convention d'écriture, et ça referme le cas
 *    du lien partagé ou remis en favori côté serveur — là où le nettoyage de
 *    l'URL dans le navigateur, lui, ne protège que celui qui recharge.
 */

declare const marque: unique symbol;

/** Un fait établi par une lecture en base. Infabricable ailleurs. */
export type Preuve<T> = T & { readonly [marque]: true };

const atteste = <T>(fait: T): Preuve<T> => fait as Preuve<T>;

/**
 * La fenêtre de fraîcheur.
 *
 * Dix minutes : assez large pour un aller-retour OAuth lent ou un paiement
 * qu'on termine en cherchant sa carte, assez étroite pour qu'un lien
 * réouvert le lendemain ne dise plus rien.
 */
const FRAICHEUR_MS = 10 * 60 * 1000;

const recent = (horodatage: string | null | undefined): boolean =>
  horodatage != null && Date.now() - new Date(horodatage).getTime() < FRAICHEUR_MS;

export type EtatDiscord = {
  /** Une liaison existe, et elle vient d'être établie. */
  readonly lieRecemment: boolean;
  /** Un `grant` a bien été empilé pour ce compte — donc un accès est en route. */
  readonly roleEnFile: boolean;
};

/**
 * Ce qu'on peut affirmer d'une liaison Discord qui vient d'avoir lieu.
 *
 * `discord_sync_queue` se lit avec la clé de service : la table est réservée au
 * staff par `discord_sync_queue_staff_lit`, et un client n'y verrait rien même
 * pour ses propres lignes. Le filtre `user_id` est donc la seule chose qui
 * cloisonne ici — il porte l'identifiant de la session, jamais une valeur venue
 * du navigateur.
 */
export async function lireEtatDiscord(): Promise<Preuve<EtatDiscord>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return atteste({ lieRecemment: false, roleEnFile: false });

  const { data: lien } = await supabase.from('discord_links').select('derniere_sync').maybeSingle();

  const lieRecemment = recent(lien?.derniere_sync);

  // Inutile d'interroger la file si la liaison n'est pas fraîche : aucun des
  // deux messages ne s'affichera.
  if (!lieRecemment) return atteste({ lieRecemment: false, roleEnFile: false });

  const { data: enFile } = await createServiceRoleClient()
    .from('discord_sync_queue')
    .select('id')
    .eq('user_id', user.id)
    .eq('action', 'grant')
    .in('statut', ['en_attente', 'en_cours', 'echoue', 'reussi'])
    // Une ligne encore à traiter compte quel que soit son âge : la liaison
    // n'en empile pas de seconde, et l'accès est bien en route. Une ligne
    // traitée ne compte que si elle vient d'être empilée — sinon elle peut
    // viser un ancien compte Discord.
    .or(`statut.neq.reussi,created_at.gte.${new Date(Date.now() - FRAICHEUR_MS).toISOString()}`)
    .limit(1);

  return atteste({ lieRecemment: true, roleEnFile: Boolean(enFile?.length) });
}

export type EtatPaiement = {
  /** Une commande de ce client est passée à `payee` il y a quelques minutes. */
  readonly paiementRecent: boolean;
};

/**
 * Ce qu'on peut affirmer d'un paiement qui vient d'aboutir.
 *
 * **C'est le plus important des sept codes.** « Paiement reçu » affiché à qui
 * n'a rien payé est le pire message que le site puisse produire : il envoie
 * quelqu'un attendre un accès que personne n'a demandé, et il le fait avec
 * l'autorité d'un site marchand.
 *
 * Lu sous RLS par `orders_client_lit_les_siennes` : le moteur garantit qu'on ne
 * voit que ses propres commandes, il n'y a rien à filtrer ici.
 *
 * `updated_at` et non `created_at` : la commande naît `en_attente` à l'ouverture
 * du paiement et passe `payee` au webhook. C'est ce second instant qui est
 * l'événement dont l'URL parle.
 */
export async function lireEtatPaiement(): Promise<Preuve<EtatPaiement>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('orders')
    .select('id')
    .eq('statut', 'payee')
    .gte('updated_at', new Date(Date.now() - FRAICHEUR_MS).toISOString())
    .limit(1);

  return atteste({ paiementRecent: Boolean(data?.length) });
}

export type EtatCompte = {
  /** Une session est ouverte, sur un compte tout juste créé. */
  readonly compteCreeRecemment: boolean;
};

/**
 * Ce qu'on peut affirmer d'un compte qui vient d'être créé.
 *
 * Aucune requête : `auth.users.created_at` arrive avec la session. Le tunnel de
 * qualification crée le compte puis redirige vers `/reserver` — quelques
 * secondes séparent les deux.
 */
export async function lireEtatCompte(): Promise<Preuve<EtatCompte>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return atteste({ compteCreeRecemment: Boolean(user) && recent(user?.created_at) });
}
