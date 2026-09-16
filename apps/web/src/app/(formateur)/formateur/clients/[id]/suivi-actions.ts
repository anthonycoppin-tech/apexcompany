'use server';

import { revalidatePath } from 'next/cache';

import {
  CANAUX,
  MOTIFS_PERTE,
  STATUTS_MANUELS,
  type Canal,
  type MotifPerte,
  type StatutManuel,
} from '@/lib/formateur/suivi';
import { createClient } from '@/lib/supabase/server';

export type EtatSuivi = { readonly erreur: string | null; readonly ok: boolean };

const LONGUEUR_MAX = 2000;

/**
 * Consigner un échange avec un prospect, et faire avancer son statut.
 *
 * Fichier séparé de `actions.ts` pour une raison de calendrier, pas de
 * conception : ce dernier est en cours de reprise sur la branche du système de
 * messages, et deux modifications concurrentes du même fichier se règlent mal.
 *
 * **Le journal d'abord, jamais à la place du statut.** Chaque échange devient
 * une ligne de `lead_events`, immuable par la RLS : c'est ce qui permet de
 * répondre à « qui l'a appelé, quand, et qu'est-ce qu'il a dit » sans dépendre
 * de la mémoire de quelqu'un.
 *
 * **Un appel ou un message sort la personne de « à contacter ».** Sans ça, la
 * file du tableau de bord continuerait de la proposer, et on la rappellerait
 * deux fois. Une note interne, elle, n'est pas un contact.
 *
 * Écrit sous RLS : `leads_formateur_modifie_les_siens` et
 * `lead_events_formateur_insere` bornent l'action aux prospects affectés, même
 * si elle est appelée directement.
 */
export async function consignerEchange(
  _precedent: EtatSuivi,
  donnees: FormData,
): Promise<EtatSuivi> {
  const leadId = (donnees.get('lead_id') ?? '').toString();
  const canal = (donnees.get('canal') ?? '').toString() as Canal;
  const contenu = (donnees.get('contenu') ?? '').toString().trim();
  const statutDemande = (donnees.get('statut') ?? '').toString();
  const motif = (donnees.get('motif') ?? '').toString();

  if (!leadId) return { erreur: 'Fiche manquante.', ok: false };
  if (!(canal in CANAUX)) return { erreur: 'Choisissez le type d’échange.', ok: false };
  if (contenu.length > LONGUEUR_MAX) {
    return { erreur: `Le texte dépasse ${LONGUEUR_MAX} caractères.`, ok: false };
  }

  const statutManuel = (STATUTS_MANUELS as readonly string[]).includes(statutDemande)
    ? (statutDemande as StatutManuel)
    : null;

  if (statutManuel === 'perdu' && !(motif in MOTIFS_PERTE)) {
    return { erreur: 'Indiquez pourquoi la personne est perdue.', ok: false };
  }
  if (!contenu && !statutManuel && canal === 'note') {
    return { erreur: 'La note est vide.', ok: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erreur: 'Session expirée.', ok: false };

  const { data: lead } = await supabase
    .from('leads')
    .select('id, statut')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return { erreur: 'Fiche introuvable.', ok: false };

  // Un client ne redevient pas prospect par un clic : son statut vient d'un
  // paiement, et c'est le paiement qui fait foi.
  if (lead.statut === 'gagne' && statutManuel) {
    return { erreur: 'Cette personne est cliente : son statut ne se change pas ici.', ok: false };
  }

  let statutApres = lead.statut;
  if (statutManuel) {
    statutApres = statutManuel;
  } else if (lead.statut === 'nouveau' && canal !== 'note') {
    statutApres = 'contacte';
  }

  if (statutApres !== lead.statut) {
    const { error } = await supabase
      .from('leads')
      .update({ statut: statutApres })
      .eq('id', lead.id);
    if (error) return { erreur: 'Le statut n’a pas pu être mis à jour.', ok: false };
  }

  const { error } = await supabase.from('lead_events').insert({
    lead_id: lead.id,
    type: 'echange',
    created_by: user.id,
    payload: {
      canal,
      contenu: contenu || null,
      statut_avant: lead.statut,
      statut_apres: statutApres,
      motif: statutApres === 'perdu' ? (motif as MotifPerte) : null,
    },
  });
  if (error) return { erreur: 'L’échange n’a pas pu être enregistré.', ok: false };

  revalidatePath(`/formateur/clients/${lead.id}`);
  revalidatePath('/formateur');
  revalidatePath('/formateur/clients');

  return { erreur: null, ok: true };
}
