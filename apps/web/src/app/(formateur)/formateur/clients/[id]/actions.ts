'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type EtatProposition = { readonly erreur: string | null; readonly ok: boolean };

/**
 * Émettre une proposition à la fin de l'audit.
 *
 * Remplace le lien de paiement collé à la main dans Discord ou dans un mail.
 * Quatre choses que le lien brut ne donnait pas :
 *
 * - **la conversion devient mesurable** — qui a proposé quoi, à quel prix, et
 *   est-ce que ça a été payé ;
 * - **le produit vendu change souvent**, c'est le cas nominal ici : une nouvelle
 *   proposition périme la précédente, et l'historique garde les deux. Avec des
 *   liens bruts, deux liens restaient valides en même temps sans que personne
 *   sache lequel faisait foi ;
 * - **une proposition expire**, ce qui évite qu'un lien à 5 000 € émis en
 *   janvier soit payé en septembre au tarif de janvier ;
 * - **le prix est tracé.**
 *
 * Le montant n'est pas saisi : il est repris du catalogue. La remise accordée
 * par un formateur n'est pas arbitrée (§8.6) — tant qu'aucun plafond n'est
 * décidé, offrir un champ libre reviendrait à autoriser en silence ce qui n'a
 * pas été autorisé.
 *
 * Écrit sous RLS : `propositions_formateur_emet` impose `formateur_id =
 * auth.uid()`, donc un formateur ne peut pas émettre au nom d'un autre, même en
 * appelant cette action directement.
 */
export async function emettreProposition(
  _precedent: EtatProposition,
  donnees: FormData,
): Promise<EtatProposition> {
  const leadId = (donnees.get('lead_id') ?? '').toString();
  const formationId = (donnees.get('formation_id') ?? '').toString();
  const jours = Number((donnees.get('validite_jours') ?? '7').toString());

  if (!leadId || !formationId) return { erreur: 'Formation manquante.', ok: false };
  if (!Number.isFinite(jours) || jours < 1 || jours > 90) {
    return { erreur: 'La validité doit être comprise entre 1 et 90 jours.', ok: false };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { erreur: 'Session expirée.', ok: false };

  const { data: lead } = await supabase
    .from('leads')
    .select('id, user_id')
    .eq('id', leadId)
    .maybeSingle();

  if (!lead) return { erreur: 'Fiche introuvable.', ok: false };

  // Le tunnel crée le compte avant le rendez-vous, donc ce cas ne devrait pas
  // se présenter — sauf pour une fiche saisie à la main ou importée d'avant.
  // Sans compte, la proposition n'aurait personne à qui s'afficher et rien pour
  // la protéger : la RLS s'appuie sur `user_id`.
  if (!lead.user_id) {
    return {
      erreur:
        "Cette personne n'a pas encore de compte : la proposition ne pourrait pas lui être présentée.",
      ok: false,
    };
  }

  const { data: formation } = await supabase
    .from('formations')
    .select('id, prix_cents, devise')
    .eq('id', formationId)
    .maybeSingle();

  if (!formation) return { erreur: 'Formation introuvable.', ok: false };

  // La nouvelle périme les précédentes. Deux propositions valides en même temps
  // pour la même personne, c'est exactement le désordre que cette table existe
  // pour supprimer.
  await supabase
    .from('propositions')
    .update({ statut: 'expiree' })
    .eq('user_id', lead.user_id)
    .eq('statut', 'envoyee');

  const expireLe = new Date();
  expireLe.setDate(expireLe.getDate() + jours);

  const { error } = await supabase.from('propositions').insert({
    lead_id: lead.id,
    user_id: lead.user_id,
    formation_id: formation.id,
    formateur_id: user.id,
    montant_cents: formation.prix_cents,
    devise: formation.devise,
    statut: 'envoyee',
    expire_le: expireLe.toISOString(),
  });

  if (error) {
    return { erreur: "L'émission a échoué. Réessaie dans un instant.", ok: false };
  }

  // Le prospect avance dans le pipeline. `gagne` attendra le paiement : c'est le
  // webhook qui le posera, pas cet écran.
  await supabase.from('leads').update({ statut: 'proposition' }).eq('id', lead.id);

  await supabase.from('lead_events').insert({
    lead_id: lead.id,
    type: 'proposition_emise',
    payload: { formation_id: formation.id, expire_le: expireLe.toISOString() },
    created_by: user.id,
  });

  revalidatePath(`/formateur/clients/${lead.id}`);
  revalidatePath('/formateur');

  return { erreur: null, ok: true };
}
