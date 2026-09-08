'use server';

import { revalidatePath } from 'next/cache';

import { PIPELINE } from '@/lib/crm/pipeline';
import { createClient } from '@/lib/supabase/server';

export type EtatFiche = { readonly erreur: string | null; readonly ok: boolean };

/**
 * Affecter un prospect à un formateur, et faire avancer son statut.
 *
 * **L'affectation n'est pas un détail d'organisation : c'est le périmètre de
 * sécurité du formateur.** `leads.assigned_to` est ce que lisent les politiques
 * RLS pour décider ce qu'il voit — écrire ici ouvre un accès, effacer le
 * referme. C'est la raison pour laquelle l'affectation est explicite et non
 * dérivée des rendez-vous passés : le périmètre reste une décision, pas une
 * conséquence de l'historique.
 *
 * Écrit sous RLS, par `leads_staff`. Un formateur qui appellerait cette action
 * n'y arriverait pas : la politique ne l'autorise que sur ses propres fiches,
 * et jamais à changer l'affectation vers quelqu'un d'autre.
 */
export async function mettreAJourFiche(
  _precedent: EtatFiche,
  donnees: FormData,
): Promise<EtatFiche> {
  const id = (donnees.get('lead_id') ?? '').toString();
  const affecteA = (donnees.get('assigned_to') ?? '').toString();
  const statut = (donnees.get('statut') ?? '').toString();

  if (!id) return { erreur: 'Fiche introuvable.', ok: false };

  if (statut && !PIPELINE.some((e) => e.valeur === statut)) {
    return { erreur: 'Statut inconnu.', ok: false };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('leads')
    .update({
      // Chaîne vide = « retirer l'affectation », qui doit rester possible :
      // un formateur qui quitte l'équipe ne doit pas garder ses accès par
      // l'oubli d'une case.
      assigned_to: affecteA || null,
      ...(statut ? { statut: statut as never } : {}),
    })
    .eq('id', id);

  if (error) {
    return { erreur: "L'enregistrement a échoué. Réessaie dans un instant.", ok: false };
  }

  revalidatePath(`/admin/crm/leads/${id}`);
  revalidatePath('/admin/crm/leads');

  return { erreur: null, ok: true };
}
