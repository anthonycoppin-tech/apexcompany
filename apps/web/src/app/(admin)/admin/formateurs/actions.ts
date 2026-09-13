'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export type EtatFiche = { readonly erreur: string | null; readonly ok: boolean };

/**
 * Créer ou modifier une fiche publique de formateur.
 *
 * **Une fiche n'est pas un compte.** `profiles` porte l'email et le téléphone ;
 * ceci porte ce qui s'affiche sur `/formateurs`. Le rattachement à un compte
 * reste facultatif dans les deux sens : on peut présenter quelqu'un qui n'a pas
 * de compte, et un compte n'a pas vocation à être publié.
 *
 * Aucune règle de publication n'est imposée au-delà du nom. Les deux garde-fous
 * du projet — rôle Discord obligatoire, consentement obligatoire — existent
 * parce que leur absence casse quelque chose en silence. Une biographie vide
 * qui s'affiche se voit immédiatement : ça ne mérite pas une contrainte, ça
 * mérite un coup d'œil à la page.
 */
export async function enregistrerFiche(
  _precedent: EtatFiche,
  donnees: FormData,
): Promise<EtatFiche> {
  const lu = (champ: string) => (donnees.get(champ) ?? '').toString().trim();

  const id = lu('id');
  const nom = lu('nom');
  const photoUrl = lu('photo_url');

  if (!nom) return { erreur: 'Le nom est nécessaire.', ok: false };

  // Une adresse d'image invalide ne casse rien côté serveur, mais affiche une
  // image brisée sur la page d'équipe — et personne ne va la revérifier.
  if (photoUrl) {
    let valide = false;
    try {
      const url = new URL(photoUrl);
      valide = url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      valide = false;
    }
    if (!valide) {
      return {
        erreur: 'L’adresse de la photo doit être une URL http ou https complète.',
        ok: false,
      };
    }
  }

  const ordreBrut = lu('ordre');
  const ordre = ordreBrut ? Number(ordreBrut) : 0;
  if (!Number.isInteger(ordre) || ordre < 0) {
    return { erreur: 'L’ordre doit être un nombre entier positif.', ok: false };
  }

  // Saisies séparées par des virgules, stockées en tableau. Les vides sautent,
  // sinon une virgule en trop crée une spécialité sans nom.
  const specialites = lu('specialites')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const supabase = await createClient();

  const valeurs = {
    nom,
    fonction: lu('fonction') || null,
    biographie: lu('biographie') || null,
    specialites,
    photo_url: photoUrl || null,
    user_id: lu('user_id') || null,
    publie: lu('publie') === 'on',
    ordre,
  };

  // Écrit sous RLS : `formateurs_fiches_staff_ecrit` réserve l'écriture au staff.
  const { data, error } = id
    ? await supabase.from('formateurs_fiches').update(valeurs).eq('id', id).select('id').single()
    : await supabase.from('formateurs_fiches').insert(valeurs).select('id').single();

  if (error) {
    return {
      erreur:
        error.code === '23505'
          ? 'Ce compte est déjà rattaché à une autre fiche : un compte, une fiche.'
          : 'L’enregistrement a échoué. Réessaie dans un instant.',
      ok: false,
    };
  }

  revalidatePath('/admin/formateurs');
  revalidatePath('/formateurs');

  if (!id) redirect(`/admin/formateurs/${data.id}`);

  return { erreur: null, ok: true };
}

export async function supprimerFiche(donnees: FormData): Promise<void> {
  const id = (donnees.get('id') ?? '').toString();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('formateurs_fiches').delete().eq('id', id);

  revalidatePath('/admin/formateurs');
  revalidatePath('/formateurs');
  redirect('/admin/formateurs');
}
