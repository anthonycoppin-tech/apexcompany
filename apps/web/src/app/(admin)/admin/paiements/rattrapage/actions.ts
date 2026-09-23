'use server';

import { revalidatePath } from 'next/cache';

import type { Json } from '@apex/db';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';

/**
 * Rattacher un encaissement Whop arrivé sans métadonnées.
 *
 * Il en arrivera : le client a diffusé seize liens de paiement avant que le
 * site ne sache en ouvrir, et un lien envoyé en message privé ne se rappelle
 * pas. Le webhook nomme ces paiements plutôt que de les avaler, et c'est ici
 * qu'on les referme.
 *
 * **Le rattachement passe par `traiter_paiement()`, comme un paiement normal.**
 * C'est tout l'intérêt : commande, encaissement, inscription, facture, rôle
 * Discord, proposition et prospect se posent dans **une seule transaction**,
 * exactement comme si le paiement était passé par le site. Écrire ici un
 * raccourci — créer l'inscription à la main, par exemple — rouvrirait la faille
 * que cette fonction existe pour fermer : un accès ouvert sans facture, ou une
 * facture sans rôle Discord.
 *
 * **L'identifiant de l'événement d'origine est réutilisé**, et c'est ce qui rend
 * le geste idempotent : `payment_events` porte une contrainte d'unicité sur
 * `(provider, provider_event_id)`. Deux administrateurs qui rattachent le même
 * paiement en même temps ne peuvent pas l'encaisser deux fois — le second
 * appel ressort avec `deja_traite`.
 *
 * **Ce qui manque à ces paiements et qu'on ne peut pas inventer** : l'acceptation
 * des CGV. Elle est enregistrée dans `consents` au moment d'ouvrir un paiement
 * sur le site (« pas de preuve, pas de vente », 21 septembre), et un paiement
 * passé hors du site n'en a aucune. On ne la fabrique pas. L'écran le dit, et
 * la trace du rattachement reste dans `automation_logs`.
 */
export async function rattacherPaiement(
  _precedent: EtatAction,
  donnees: FormData,
): Promise<EtatAction> {
  const logId = (donnees.get('log_id') ?? '').toString();
  const formationId = (donnees.get('formation_id') ?? '').toString();
  const email = (donnees.get('email') ?? '').toString().trim().toLowerCase();

  if (!logId || !formationId || !email) {
    return echoue('Il manque le produit ou l’adresse du client.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return echoue('Session expirée.');

  const admin = createServiceRoleClient();

  const { data: journal } = await admin
    .from('automation_logs')
    .select('id, details')
    .eq('id', logId)
    .eq('declencheur', 'whop.rattrapage')
    .maybeSingle();

  if (!journal) return echoue('Ce paiement n’est plus dans la file.');

  const details = (journal.details ?? {}) as {
    event?: string;
    paiement?: string | null;
    montant_cents?: number | null;
    devise?: string | null;
    adhesion?: string | null;
  };

  // Sans montant lisible, il n'y a rien à encaisser : le saisir à la main
  // reviendrait à inventer une écriture comptable.
  if (typeof details.montant_cents !== 'number' || !details.event) {
    return echoue(
      'Ce paiement n’a pas de montant lisible. Il faut le retrouver dans Whop et le traiter à la main.',
    );
  }

  // Le compte du client, par son adresse. C'est l'administrateur qui l'affirme,
  // pas une ressemblance devinée par le webhook.
  const { data: profil } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!profil) {
    return echoue(
      'Aucun compte avec cette adresse. Le client doit d’abord en créer un depuis /connexion.',
    );
  }

  const { error } = await admin.rpc('traiter_paiement', {
    p_provider: 'whop',
    // L'événement d'origine : c'est lui qui rend le rattachement idempotent.
    p_event_id: details.event,
    p_event_type: 'rattrapage.manuel',
    p_payload: { rattache_par: user.id, journal: journal.id, email } as Json,
    p_user_id: profil.id,
    p_formation_id: formationId,
    p_montant_cents: details.montant_cents,
    p_devise: (details.devise ?? 'EUR').toUpperCase(),
    // Faute de commande ouverte par le site, l'identifiant du paiement fait
    // office de référence : il est unique et stable chez Whop.
    p_provider_order_id: details.paiement ?? details.event,
    p_provider_payment_id: details.paiement ?? details.event,
    p_subscription_id: details.adhesion ?? undefined,
  });

  if (error) {
    return echoue(`Le rattachement a échoué : ${error.message}`);
  }

  // La trace du geste, à côté de la ligne qui l'a appelé. `succes` referme la
  // file : l'écran ne liste que les `echec` dont le paiement n'a pas encore
  // d'encaissement.
  await admin.from('automation_logs').insert({
    declencheur: 'whop.rattrapage',
    entite_type: 'payments',
    statut: 'succes',
    details: {
      journal: journal.id,
      event: details.event,
      rattache_par: user.id,
      email,
      formation_id: formationId,
      sans_acceptation_cgv: true,
    },
  });

  revalidatePath('/admin/paiements/rattrapage');
  revalidatePath('/admin/paiements/transactions');

  return reussi(`Paiement rattaché à ${email}. L’accès et la facture sont ouverts.`);
}
