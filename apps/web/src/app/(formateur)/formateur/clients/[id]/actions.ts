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
 * **Le montant est saisissable, sans plafond.** Tranché par le chef de projet
 * le 8 septembre 2026 : Franck dirige l'accompagnement commercial et décide
 * seul du prix qu'il propose. Le prix catalogue sert de valeur par défaut, pas
 * de valeur imposée.
 *
 * Ce qui remplace le plafond, c'est la trace. Le montant proposé est écrit dans
 * la proposition, et l'écart avec le prix catalogue est consigné dans
 * `lead_events` : une remise accordée reste visible dans l'historique du
 * prospect, sans que personne ait à la déclarer. C'est la quatrième raison
 * d'exister de cette table — « le prix est tracé » — et elle prend tout son
 * sens maintenant que le prix peut bouger.
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

  // Saisi en euros, stocké en centimes : l'argent est un entier partout
  // ailleurs, et la conversion se fait à la frontière plutôt que de laisser
  // filer un flottant dans le reste du code.
  const montantSaisi = (donnees.get('montant_euros') ?? '').toString().trim().replace(',', '.');

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

  // Le prix catalogue est la valeur par défaut, pas la valeur imposée : un
  // champ vide vaut « le tarif affiché ».
  const montantCents = montantSaisi ? Math.round(Number(montantSaisi) * 100) : formation.prix_cents;

  if (!Number.isFinite(montantCents) || montantCents < 0) {
    return { erreur: 'Le montant proposé n’est pas un nombre valide.', ok: false };
  }

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
    montant_cents: montantCents,
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

  // La trace du prix, y compris quand il s'écarte du catalogue. Sans plafond
  // sur la remise, c'est cet historique qui permet de constater après coup ce
  // qui a été accordé — et il s'écrit tout seul, sans que le formateur ait à
  // déclarer quoi que ce soit.
  await supabase.from('lead_events').insert({
    lead_id: lead.id,
    type: 'proposition_emise',
    payload: {
      formation_id: formation.id,
      expire_le: expireLe.toISOString(),
      montant_cents: montantCents,
      prix_catalogue_cents: formation.prix_cents,
      remise_cents: Math.max(0, formation.prix_cents - montantCents),
    },
    created_by: user.id,
  });

  revalidatePath(`/formateur/clients/${lead.id}`);
  revalidatePath('/formateur');

  return { erreur: null, ok: true };
}
