'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';

/**
 * Mise à jour de ses informations personnelles.
 *
 * Écrit sous RLS, par `profiles_modifie_le_sien` : la politique impose
 * `id = auth.uid()`, donc il n'y a rien à vérifier ici. C'est le moteur qui
 * garantit qu'on ne modifie que sa propre fiche, pas ce fichier.
 *
 * Le **nom de famille** compte plus qu'il n'y paraît : le formulaire de
 * qualification ne le demande pas, et la facturation l'exige. C'est ici, ou au
 * paiement, qu'il se remplit.
 *
 * L'email ne se change pas depuis cet écran : il porte l'identité du compte et
 * sa modification passe par une vérification côté authentification, pas par une
 * mise à jour de `profiles`.
 */
export async function mettreAJourCompte(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const prenom = (donnees.get('prenom') ?? '').toString().trim();
  const nom = (donnees.get('nom') ?? '').toString().trim();
  const telephone = (donnees.get('telephone') ?? '').toString().trim();

  if (!prenom) return echoue('Le prénom est nécessaire.');

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return echoue('Session expirée. Reconnecte-toi pour continuer.');

  const { error } = await supabase
    .from('profiles')
    .update({ prenom, nom: nom || null, telephone: telephone || null })
    .eq('id', user.id);

  if (error) {
    return echoue("L'enregistrement a échoué. Réessaie dans un instant.");
  }

  revalidatePath('/espace/compte');
  return reussi('Enregistré.');
}
