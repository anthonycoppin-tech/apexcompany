import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Les comptes qu'une fiche publique peut désigner.
 *
 * Les internes uniquement — formateur, admin, owner. Un client n'a rien à faire
 * sur la page d'équipe, et proposer la liste complète des comptes ferait de ce
 * menu déroulant un annuaire de la clientèle.
 *
 * Le rattachement n'accorde aucun droit : c'est `user_roles` qui décide de ce
 * qu'une personne peut faire, ici et partout ailleurs.
 */
export async function comptesRattachables(
  supabase: Client,
): Promise<Array<{ id: string; libelle: string }>> {
  const [{ data: attributions }, { data: profils }] = await Promise.all([
    supabase.from('user_roles').select('user_id, role').in('role', ['formateur', 'admin', 'owner']),
    supabase.from('profiles').select('id, prenom, nom, email'),
  ]);

  const internes = new Set((attributions ?? []).map((a) => a.user_id));

  return (profils ?? [])
    .filter((p) => internes.has(p.id))
    .map((p) => ({
      id: p.id,
      libelle: [p.prenom, p.nom].filter(Boolean).join(' ') || p.email,
    }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
}
