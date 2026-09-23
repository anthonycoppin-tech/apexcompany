import 'server-only';

import type { Database } from '@apex/db';

import { dateCourte } from '@/lib/format';
import type { createClient } from '@/lib/supabase/server';

type TypeProduit = Database['public']['Enums']['type_produit'];

export type AccesExistant =
  | { readonly bloque: true; readonly raison: string }
  | { readonly bloque: false; readonly prolongeDepuis: string | null };

/**
 * Ce que le client détient déjà du produit qu'il s'apprête à payer.
 *
 * **Le cas qui a motivé ce fichier** : une proposition d'abonnement restée
 * ouverte chez quelqu'un qui est déjà abonné. Rien ne l'arrêtait, et un second
 * abonnement prélève deux fois par mois — pour un seul accès, puisque
 * l'inscription est unique par produit.
 *
 * Trois réponses, une par type de produit :
 * - **abonnement** déjà actif (ou impayé, donc toujours en cours chez le prestataire) :
 *   bloqué ;
 * - **formation** déjà acquise : bloqué, l'accès est à vie ;
 * - **accompagnement** en cours : permis, c'est un renouvellement, et
 *   `traiter_paiement()` ajoute la durée à ce qui reste.
 *
 * Lu avec la session du client : la RLS ne lui montre que ses propres lignes.
 * Appelé à l'affichage **et** juste avant d'ouvrir le paiement — l'écran peut
 * dater d'avant un achat fait dans un autre onglet.
 */
export async function lireAccesExistant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  formation: { id: string; titre: string; type_produit: TypeProduit },
): Promise<AccesExistant> {
  const [inscription, abonnement] = await Promise.all([
    supabase
      .from('inscriptions')
      .select('date_fin_acces')
      .eq('user_id', userId)
      .eq('formation_id', formation.id)
      .eq('statut', 'active')
      .maybeSingle(),
    formation.type_produit === 'abonnement'
      ? supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .eq('formation_id', formation.id)
          .in('statut', ['active', 'impayee'])
          .limit(1)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);

  if (formation.type_produit === 'abonnement') {
    if (inscription.data || abonnement.data?.length) {
      return {
        bloque: true,
        raison: `Vous êtes déjà abonné à « ${formation.titre} ». Votre abonnement se gère depuis la page Factures de votre espace.`,
      };
    }
    return { bloque: false, prolongeDepuis: null };
  }

  if (!inscription.data) return { bloque: false, prolongeDepuis: null };

  if (formation.type_produit === 'formation' || inscription.data.date_fin_acces === null) {
    return {
      bloque: true,
      raison: `Vous avez déjà accès à « ${formation.titre} », sans date de fin.`,
    };
  }

  return { bloque: false, prolongeDepuis: inscription.data.date_fin_acces };
}

/** La phrase qui annonce un renouvellement, pour qu'il ne surprenne personne. */
export const phraseProlongation = (fin: string, jours: number | null) =>
  `Votre accès actuel court jusqu’au ${dateCourte(fin)} : ${
    jours ? `ces ${jours} jours s’y ajoutent` : 'cette durée s’y ajoute'
  }, rien n’est perdu.`;
