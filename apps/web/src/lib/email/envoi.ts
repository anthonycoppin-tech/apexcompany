import 'server-only';

import type { Email } from './modeles';

/**
 * L'envoi d'un email par Resend, en un appel REST.
 *
 * Pas de SDK : un seul point d'appel, et une dépendance de moins à tenir à
 * jour pour un `fetch`.
 *
 * **La clé d'idempotence est ce qui empêche le doublon** quand la tâche
 * reprend une ligne dont elle ne sait pas si elle est partie — le registre
 * réserve, Resend dédoublonne. Les deux sont nécessaires : le registre seul
 * ne sait rien d'un envoi réussi dont la réponse s'est perdue.
 */

export type ResultatEnvoi = { ok: true; id: string } | { ok: false; erreur: string };

export const envoiConfigure = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function envoyer(
  destinataire: string,
  email: Email,
  idempotence: string,
): Promise<ResultatEnvoi> {
  const cle = process.env.RESEND_API_KEY;
  const expediteur = process.env.EMAIL_FROM;
  if (!cle || !expediteur) return { ok: false, erreur: 'Envoi non configuré' };

  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cle}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotence,
      },
      body: JSON.stringify({
        from: expediteur,
        to: [destinataire],
        subject: email.sujet,
        html: email.html,
        text: email.texte,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const corps = (await reponse.json().catch(() => null)) as {
      id?: string;
      message?: string;
    } | null;

    if (!reponse.ok || !corps?.id) {
      return {
        ok: false,
        erreur: `Resend ${reponse.status} : ${corps?.message ?? 'réponse illisible'}`,
      };
    }
    return { ok: true, id: corps.id };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : String(e) };
  }
}
