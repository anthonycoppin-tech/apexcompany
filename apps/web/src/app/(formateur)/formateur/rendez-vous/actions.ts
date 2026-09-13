'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';

const ISSUES = ['honore', 'absent', 'annule'] as const;
type Issue = (typeof ISSUES)[number];

/**
 * Consigner l'issue d'un audit et son compte rendu.
 *
 * Écrit avec le client à **session**, donc sous RLS : la politique
 * `appointments_formateur_modifie` n'autorise l'écriture que sur les rendez-vous
 * dont le formateur est le conseiller. Passer par la clé de service ici aurait
 * fonctionné aussi — et aurait remplacé une garantie du moteur par la confiance
 * dans ce fichier. L'identifiant du rendez-vous vient du navigateur : c'est
 * exactement le cas où la RLS doit rester en travers du chemin.
 *
 * Sans `issue`, pas de statistique de rendez-vous non honorés — le premier poste
 * de perte d'un tunnel de vente par appel.
 */
export async function consignerIssue(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const id = (donnees.get('id') ?? '').toString();
  const issue = (donnees.get('issue') ?? '').toString();
  const compteRendu = (donnees.get('compte_rendu') ?? '').toString().trim();

  if (!id) return echoue('Rendez-vous introuvable.');
  if (!ISSUES.includes(issue as Issue)) return echoue('Issue invalide.');

  const supabase = await createClient();

  const { error } = await supabase
    .from('appointments')
    .update({
      issue: issue as Issue,
      compte_rendu: compteRendu || null,
      // Le statut de la réservation suit l'issue quand elle est définitive.
      // Cal.com ne saura jamais qu'un rendez-vous confirmé a été un no-show :
      // seul le formateur peut le dire.
      statut: issue === 'honore' ? 'honore' : issue === 'absent' ? 'absent' : 'annule',
    })
    .eq('id', id);

  if (error) {
    return echoue("L'enregistrement a échoué. Réessaie dans un instant.");
  }

  revalidatePath('/formateur/rendez-vous');
  revalidatePath('/formateur');

  return reussi('Compte rendu enregistré.');
}
