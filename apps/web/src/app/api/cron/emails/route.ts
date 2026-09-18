import { NextResponse } from 'next/server';

import { refuserSiNonAutorise } from '@/lib/cron/autorisation';
import { envoiConfigure } from '@/lib/email/envoi';
import { executerTacheEmails } from '@/lib/email/tache';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Déclencheur horaire des emails transactionnels. La logique est dans
 * `lib/email/tache.ts` ; cette route garde la porte.
 *
 * **Sans `RESEND_API_KEY`, elle refuse avant de lire quoi que ce soit.** Sinon
 * elle réserverait des lignes au registre pour des emails qui ne peuvent pas
 * partir, et épuiserait leurs trois tentatives en trois heures — le jour où la
 * clé arrive, plus rien ne partirait.
 */
async function executer(request: Request) {
  const refus = refuserSiNonAutorise(request);
  if (refus) return refus;

  if (!envoiConfigure()) {
    return NextResponse.json({ erreur: 'Envoi d’emails non configuré' }, { status: 503 });
  }

  try {
    const bilan = await executerTacheEmails(createServiceRoleClient());
    // Des échecs d'envoi ne font pas une tâche en échec : ils sont au registre
    // et seront retentés. Seule une tâche qui n'a pas pu lire la base répond 500.
    return NextResponse.json({ resultat: bilan });
  } catch (e) {
    return NextResponse.json(
      { erreur: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return executer(request);
}

export async function POST(request: Request) {
  return executer(request);
}
