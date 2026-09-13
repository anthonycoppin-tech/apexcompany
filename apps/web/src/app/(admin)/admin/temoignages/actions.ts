'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export type EtatTemoignage = { readonly erreur: string | null; readonly ok: boolean };

/**
 * Créer ou modifier un témoignage.
 *
 * **Le consentement conditionne la publication**, et c'est la contrainte
 * `temoignages_publie_avec_consentement` qui a le dernier mot — elle tient même
 * si quelqu'un écrit un jour un script d'import. La vérification est doublée
 * ici pour la même raison que la cohérence du catalogue : un `23514` remontant
 * du moteur ne dit à personne *pourquoi* c'est refusé.
 *
 * Ce n'est pas une formalité d'interface. Publier le nom et les mots d'une
 * personne est un traitement de données personnelles ; sur un site de formation
 * à l'investissement, un avis publié sans accord est aussi une allégation
 * commerciale qu'on ne peut pas justifier.
 */
export async function enregistrerTemoignage(
  _precedent: EtatTemoignage,
  donnees: FormData,
): Promise<EtatTemoignage> {
  const lu = (champ: string) => (donnees.get(champ) ?? '').toString().trim();

  const id = lu('id');
  const auteur = lu('auteur');
  const contenu = lu('contenu');
  const consentement = lu('consentement') === 'on';
  const publie = lu('publie') === 'on';

  if (!auteur) return { erreur: 'L’auteur est nécessaire.', ok: false };
  if (!contenu) return { erreur: 'Le témoignage ne peut pas être vide.', ok: false };

  if (publie && !consentement) {
    return {
      erreur:
        'Un témoignage ne peut pas être publié sans consentement enregistré : ce sont le nom et les mots d’une personne. Garde-le en brouillon le temps d’obtenir son accord écrit.',
      ok: false,
    };
  }

  // La note est facultative ; renseignée, elle est bornée comme en base.
  const noteBrute = lu('note');
  let note: number | null = null;
  if (noteBrute) {
    const n = Number(noteBrute);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return { erreur: 'La note va de 1 à 5, ou reste vide.', ok: false };
    }
    note = n;
  }

  const ordreBrut = lu('ordre');
  const ordre = ordreBrut ? Number(ordreBrut) : 0;
  if (!Number.isInteger(ordre) || ordre < 0) {
    return { erreur: 'L’ordre doit être un nombre entier positif.', ok: false };
  }

  const supabase = await createClient();

  const valeurs = {
    auteur,
    contexte: lu('contexte') || null,
    contenu,
    note,
    // Une chaîne vide n'est pas un identifiant : le select « aucune » vaut null.
    formation_id: lu('formation_id') || null,
    consentement,
    publie,
    ordre,
  };

  // Écrit sous RLS : `temoignages_staff_ecrit` réserve l'écriture au staff.
  const { data, error } = id
    ? await supabase.from('temoignages').update(valeurs).eq('id', id).select('id').single()
    : await supabase.from('temoignages').insert(valeurs).select('id').single();

  if (error) {
    return {
      erreur:
        error.code === '23514'
          ? 'La base a refusé : un témoignage publié doit porter un consentement.'
          : 'L’enregistrement a échoué. Réessaie dans un instant.',
      ok: false,
    };
  }

  revalidatePath('/admin/temoignages');
  revalidatePath('/');

  // Rester sur un formulaire vide après une création laisse croire qu'il ne
  // s'est rien passé — même parti que le catalogue.
  if (!id) redirect(`/admin/temoignages/${data.id}`);

  return { erreur: null, ok: true };
}

/**
 * Supprimer un témoignage.
 *
 * Une suppression et non une dépublication : un retrait d'accord se respecte
 * en effaçant, pas en masquant. Dépublier reste possible depuis le formulaire
 * quand il s'agit seulement de retirer de l'affichage.
 */
export async function supprimerTemoignage(donnees: FormData): Promise<void> {
  const id = (donnees.get('id') ?? '').toString();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('temoignages').delete().eq('id', id);

  revalidatePath('/admin/temoignages');
  revalidatePath('/');
  redirect('/admin/temoignages');
}
