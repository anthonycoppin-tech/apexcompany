'use server';

import { revalidatePath } from 'next/cache';

import { requireRole } from '@/lib/auth/roles';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';
import { createClient } from '@/lib/supabase/server';

type Bilan = {
  possible: boolean;
  raison?: string;
  compte?: boolean;
  leads?: number;
  rendez_vous?: number;
  consentements?: number;
};

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

const decrire = (b: Bilan) =>
  [
    b.compte ? 'son compte' : null,
    pluriel(b.leads ?? 0, 'fiche prospect'),
    pluriel(b.rendez_vous ?? 0, 'rendez-vous'),
    pluriel(b.consentements ?? 0, 'consentement'),
  ]
    .filter(Boolean)
    .join(', ');

/**
 * Les deux temps d'un effacement demandé par la personne (RGPD, art. 17).
 *
 * Toute la décision est dans `effacer_personne()` — ce qui bloque, ce qui part
 * — et la base revérifie le rôle. Ces actions ne font que la traduire, et
 * imposent la confirmation par l'adresse : on n'efface pas quelqu'un d'un clic
 * distrait sur la mauvaise fiche.
 */
export async function verifierEffacement(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  await requireRole(['admin', 'owner']);
  const leadId = (donnees.get('lead_id') ?? '').toString();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('effacer_personne', {
    p_lead_id: leadId,
    p_simulation: true,
  });
  if (error) return echoue('La vérification a échoué. Réessayez dans un instant.');

  const bilan = data as unknown as Bilan;
  if (!bilan.possible) return echoue(bilan.raison ?? 'Cette personne ne peut pas être effacée.');
  return reussi(`Seront supprimés définitivement : ${decrire(bilan)}.`);
}

export async function effacer(_precedent: EtatAction, donnees: FormData): Promise<EtatAction> {
  await requireRole(['admin', 'owner']);
  const leadId = (donnees.get('lead_id') ?? '').toString();
  const confirmation = (donnees.get('confirmation') ?? '').toString().trim().toLowerCase();

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from('leads')
    .select('email')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return echoue('Cette fiche n’existe plus.');
  if (confirmation !== lead.email.toLowerCase()) {
    return echoue('L’adresse saisie ne correspond pas à celle de la fiche.');
  }

  const { data, error } = await supabase.rpc('effacer_personne', {
    p_lead_id: leadId,
    p_simulation: false,
  });
  if (error) return echoue('L’effacement a échoué. Rien n’a été supprimé.');

  const bilan = data as unknown as Bilan;
  if (!bilan.possible) return echoue(bilan.raison ?? 'Cette personne ne peut pas être effacée.');

  revalidatePath('/admin/crm/leads');
  revalidatePath('/admin');
  return reussi(
    `Effacement fait : ${decrire(bilan)}. Une trace datée, sans donnée personnelle, reste dans l’audit — c’est elle qui permet de répondre à la personne.`,
  );
}
