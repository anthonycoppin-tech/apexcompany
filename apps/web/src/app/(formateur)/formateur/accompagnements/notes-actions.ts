'use server';

import { revalidatePath } from 'next/cache';

import { TYPES_NOTE, type TypeNote } from '@/lib/formateur/suivi';
import { REPOS, echoue, reussi, type EtatAction } from '@/lib/messages/types';
import { createClient } from '@/lib/supabase/server';

const LONGUEUR_MAX = 4000;

/**
 * Les notes de suivi d'un accompagnement : objectifs, retours de séance,
 * observations.
 *
 * Tout passe par la RLS (`suivi_notes_formateur`) : lecture et écriture sur ses
 * seules affectations, et signature obligatoire — `formateur_id` doit être le
 * porteur de la session, faute de quoi l'insertion est refusée. Ces actions ne
 * vérifient donc rien que la base ne revérifie ; elles traduisent le refus.
 *
 * **Une note est interne par défaut.** La case « visible par le client » se
 * coche à la main, et la colonne a le même défaut en base : une observation
 * écrite sans y penser ne doit pas remonter dans l'espace client.
 */

/** Toutes les pages du formateur montrent des notes ou en dérivent une tâche. */
const rafraichir = () => revalidatePath('/formateur', 'layout');

export async function ajouterNote(_precedent: EtatAction, donnees: FormData): Promise<EtatAction> {
  const inscriptionId = (donnees.get('inscription_id') ?? '').toString();
  const type = (donnees.get('type') ?? '').toString() as TypeNote;
  const contenu = (donnees.get('contenu') ?? '').toString().trim();
  const visible = donnees.get('visible_client') === 'on';

  if (!inscriptionId) return echoue('Accompagnement manquant.');
  if (!(type in TYPES_NOTE)) return echoue('Choisissez le type de note.');
  if (!contenu) return echoue('La note est vide.');
  if (contenu.length > LONGUEUR_MAX) {
    return echoue(`La note dépasse ${LONGUEUR_MAX} caractères.`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return echoue('Session expirée. Reconnectez-vous.');

  const { error } = await supabase.from('suivi_notes').insert({
    inscription_id: inscriptionId,
    formateur_id: user.id,
    type,
    contenu,
    visible_client: visible,
  });

  if (error) return echoue('La note n’a pas pu être enregistrée.');

  rafraichir();
  return reussi(visible ? 'Note enregistrée, visible par le client.' : 'Note interne enregistrée.');
}

export async function changerVisibilite(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const noteId = (donnees.get('note_id') ?? '').toString();
  const visible = donnees.get('visible') === 'true';

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('suivi_notes')
    .update({ visible_client: visible })
    .eq('id', noteId)
    .select('id');

  // Zéro ligne sans erreur : la RLS a filtré — la note d'un collègue, ou une
  // affectation qui n'est plus la sienne.
  if (error || !data?.length) return echoue('Seul l’auteur de la note peut la modifier.');

  rafraichir();
  return REPOS;
}

export async function supprimerNote(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const noteId = (donnees.get('note_id') ?? '').toString();

  const supabase = await createClient();
  const { data, error } = await supabase.from('suivi_notes').delete().eq('id', noteId).select('id');

  if (error || !data?.length) return echoue('La note n’a pas pu être supprimée.');

  rafraichir();
  return REPOS;
}
