import { NextResponse } from 'next/server';

import {
  demandeAttention,
  raisonDuRebond,
  remplace,
  statutDeLEvenement,
  type StatutEvenement,
} from '@/lib/email/rebonds';
import { entetesDe, signatureValide } from '@/lib/email/signature-resend';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Webhook Resend — ce qu'on apprend d'un email **après** l'avoir envoyé.
 *
 * Sans lui, `emails_envoyes.statut` s'arrête à `envoye`, qui veut seulement
 * dire « Resend a accepté la requête ». Une adresse morte, une boîte pleine ou
 * un client qui clique sur « spam » restaient invisibles : `/admin/emails`
 * affichait « Envoyé » pour un email que personne n'a jamais reçu, et c'est la
 * page qu'on ouvre justement quand quelqu'un dit n'avoir rien reçu.
 *
 * **Tout événement vérifié est acquitté par un 200**, même ignoré, même
 * inconnu. Un webhook qui répond en erreur est rejoué, et rejouer ne créera
 * jamais l'information qui manque — ça ne fait qu'ajouter du bruit et retarder
 * les événements suivants de la file du prestataire. Seule une base injoignable
 * mérite un 500 : là, réessayer a un sens.
 */

/** Les emails d'authentification (lien de connexion) partent par le SMTP de Supabase, pas par la tâche : ils n'ont pas de ligne au registre. */
type EvenementResend = {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    bounce?: { message?: string; type?: string; subType?: string };
  };
};

/** Le webhook et la tâche horaire peuvent écrire la même ligne au même instant. On relit et on repropose plutôt que d'écraser. */
const PASSES_MAX = 3;

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (!secret) {
    // Même refus que `api/cal` : ne jamais accepter un webhook non vérifiable
    // parce que la configuration manque. Ce serait ouvrir l'écriture du
    // registre à tout Internet le jour d'un déploiement incomplet.
    return NextResponse.json({ erreur: 'Webhook non configuré' }, { status: 503 });
  }

  // Le corps brut, avant tout parsing : la signature porte sur les octets
  // reçus, et `JSON.parse` puis `JSON.stringify` ne les redonne pas à
  // l'identique.
  const corps = await request.text();

  if (!signatureValide(corps, entetesDe(request), secret)) {
    return NextResponse.json({ erreur: 'Signature invalide' }, { status: 401 });
  }

  let evenement: EvenementResend;
  try {
    evenement = JSON.parse(corps) as EvenementResend;
  } catch {
    return NextResponse.json({ erreur: 'Corps illisible' }, { status: 400 });
  }

  const statut = statutDeLEvenement(evenement.type ?? '');
  const emailId = evenement.data?.email_id;

  // `email.sent`, `email.opened`, `email.delivery_delayed` : rien qu'on ne
  // sache déjà, ou rien d'actionnable.
  if (!statut || !emailId) return NextResponse.json({ recu: true });

  const supabase = createServiceRoleClient();

  try {
    for (let passe = 0; passe < PASSES_MAX; passe++) {
      const { data: ligne, error } = await supabase
        .from('emails_envoyes')
        .select('id, modele, statut, destinataire')
        .eq('fournisseur_id', emailId)
        .maybeSingle();

      if (error) throw new Error(`registre : ${error.message}`);

      if (!ligne) return await sansLigne(supabase, evenement, statut, emailId);

      if (!remplace(ligne.statut, statut)) return NextResponse.json({ recu: true });

      // Conditionnée à l'état lu, comme la réservation de la tâche : si la
      // ligne a changé entre la lecture et l'écriture, on ne l'écrase pas, on
      // recommence à partir du nouvel état.
      const { data: majs, error: erreurMaj } = await supabase
        .from('emails_envoyes')
        .update({ statut, erreur: raisonDuRebond(statut, evenement.data?.bounce) })
        .eq('id', ligne.id)
        .eq('statut', ligne.statut)
        .select('id');

      if (erreurMaj) throw new Error(`registre : ${erreurMaj.message}`);
      if ((majs?.length ?? 0) === 0) continue;

      if (demandeAttention(statut)) {
        // Un rebond ou une plainte est un échec qui ne se voit nulle part
        // ailleurs : le client ne se plaint pas d'un email qu'il n'a pas reçu,
        // il ne sait pas qu'il existait.
        await supabase.from('automation_logs').insert({
          declencheur: 'resend.webhook',
          entite_type: 'emails_envoyes',
          entite_id: ligne.id,
          statut: 'echec',
          details: {
            evenement: evenement.type,
            modele: ligne.modele,
            destinataire: ligne.destinataire,
            motif: raisonDuRebond(statut, evenement.data?.bounce),
          },
        });
      }

      return NextResponse.json({ recu: true });
    }

    // Trois passes perdues d'affilée veut dire qu'une autre écriture gagne
    // systématiquement. On acquitte — un rejeu se perdrait pareil — et on
    // laisse la trace, parce que ce cas ne devrait pas arriver.
    await supabase.from('automation_logs').insert({
      declencheur: 'resend.webhook',
      entite_type: 'emails_envoyes',
      statut: 'echec',
      details: { evenement: evenement.type, email_id: emailId, raison: 'Écritures concurrentes' },
    });
    return NextResponse.json({ recu: true });
  } catch (e) {
    // La base est injoignable : ici, et seulement ici, un rejeu a un sens.
    return NextResponse.json(
      { erreur: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

type Supabase = ReturnType<typeof createServiceRoleClient>;

/**
 * Un événement dont l'identifiant ne correspond à aucune ligne du registre.
 *
 * Le cas normal, et il est fréquent : **les emails de connexion partent par le
 * SMTP de Supabase**, pas par la tâche horaire, donc ils n'ont jamais de ligne
 * ici. Un `livre` pour l'un d'eux n'apprend rien et ne se journalise pas.
 *
 * Un rebond, lui, se journalise — et c'est le cas le plus grave du fichier.
 * Depuis le 17 septembre un client n'a pas de mot de passe : son seul moyen
 * d'entrer est le lien envoyé par email. Si ce lien rebondit, il est dehors,
 * définitivement, et rien d'autre ne le signalerait.
 */
async function sansLigne(
  supabase: Supabase,
  evenement: EvenementResend,
  statut: StatutEvenement,
  emailId: string,
) {
  if (!demandeAttention(statut)) return NextResponse.json({ recu: true });

  const destinataire = Array.isArray(evenement.data?.to)
    ? evenement.data.to.join(', ')
    : (evenement.data?.to ?? null);

  await supabase.from('automation_logs').insert({
    declencheur: 'resend.webhook',
    entite_type: 'emails_envoyes',
    statut: 'echec',
    details: {
      evenement: evenement.type,
      email_id: emailId,
      destinataire,
      sujet: evenement.data?.subject ?? null,
      motif: raisonDuRebond(statut, evenement.data?.bounce),
      note: 'Hors registre — probablement un email de connexion envoyé par Supabase.',
    },
  });

  return NextResponse.json({ recu: true });
}
