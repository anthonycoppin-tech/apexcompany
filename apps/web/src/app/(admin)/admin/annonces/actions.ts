'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { bornesDesJours } from '@/lib/format';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';
import { createClient } from '@/lib/supabase/server';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Créer ou modifier une annonce d'événement.
 *
 * **L'échéance est obligatoire** — la base la refuse vide — et se saisit en
 * jour, pas en heure : « afficher jusqu'au 15 octobre » veut dire jusqu'à la
 * fin de ce jour-là, à Paris. Laissée vide, elle vaut le jour de l'événement :
 * c'est le cas courant, et c'est le seul qui ne demande rien à personne.
 *
 * Écrit sous RLS (`annonces_staff_ecrit`) : une action serveur est une API
 * publique, et c'est la politique qui refuse un compte hors du staff. Les
 * contraintes de lien sont doublées ici pour répondre en français plutôt
 * qu'en `23514`.
 */
export async function enregistrerAnnonce(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const lu = (champ: string) => (donnees.get(champ) ?? '').toString().trim();

  const id = lu('id');
  const titre = lu('titre');
  const dateEvenement = lu('date_evenement');
  const finSaisie = lu('fin_affichage') || dateEvenement;
  const lienUrl = lu('lien_url');
  const lienLibelle = lu('lien_libelle');

  if (!titre) return echoue('Le titre est nécessaire.');
  if (dateEvenement && !DATE.test(dateEvenement)) return echoue('La date n’est pas valide.');
  if (!finSaisie || !DATE.test(finSaisie)) {
    return echoue(
      'Indiquez jusqu’à quand l’annonce s’affiche, ou la date de l’événement : une annonce sans fin resterait en ligne après lui.',
    );
  }
  if (!!lienUrl !== !!lienLibelle) {
    return echoue('Un bouton a besoin des deux : l’adresse et le texte affiché.');
  }
  if (lienUrl && !/^(\/|https:\/\/)/.test(lienUrl)) {
    return echoue(
      'Le lien doit être une page du site (« /inscription ») ou commencer par https://.',
    );
  }

  const valeurs = {
    surtitre: lu('surtitre') || null,
    titre,
    texte: lu('texte') || null,
    date_evenement: dateEvenement || null,
    lien_url: lienUrl || null,
    lien_libelle: lienLibelle || null,
    publiee: lu('publiee') === 'on',
    fin_affichage: bornesDesJours(finSaisie, finSaisie).fin,
  };

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from('annonces').update(valeurs).eq('id', id).select('id').single()
    : await supabase.from('annonces').insert(valeurs).select('id').single();

  if (error) return echoue('L’enregistrement a échoué. Réessayez dans un instant.');

  revalidatePath('/admin/annonces');
  revalidatePath('/');

  // Rester sur un formulaire vide après une création laisse croire qu'il ne
  // s'est rien passé — même parti que le catalogue et les témoignages.
  if (!id) redirect(`/admin/annonces/${data.id}`);

  return reussi('Annonce enregistrée.');
}

/** Supprimer une annonce. La suppression est tracée dans l'audit. */
export async function supprimerAnnonce(donnees: FormData): Promise<void> {
  const id = (donnees.get('id') ?? '').toString();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('annonces').delete().eq('id', id);

  revalidatePath('/admin/annonces');
  revalidatePath('/');
  redirect('/admin/annonces');
}
