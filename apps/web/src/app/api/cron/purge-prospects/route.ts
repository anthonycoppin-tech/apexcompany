import { NextResponse } from 'next/server';

import { refuserSiNonAutorise } from '@/lib/cron/autorisation';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Déclencheur de la purge des prospects inactifs depuis trois ans.
 *
 * Même principe que `api/cron/revocation` : aucune logique ici, tout est dans
 * `purger_prospects_inactifs()`, testée en PGlite et en pgTAP. Une route à part
 * plutôt qu'un second appel dans la révocation : l'échec de l'une ne doit pas
 * empêcher l'autre, et une purge n'a pas besoin de tourner tous les jours.
 *
 * `?simulation=1` compte sans rien supprimer. À lancer avant le premier passage
 * sur des données reprises de l'ancien site, qui peuvent avoir plus de trois ans.
 */
async function executer(request: Request) {
  const refus = refuserSiNonAutorise(request);
  if (refus) return refus;

  const simulation = new URL(request.url).searchParams.get('simulation') === '1';

  const { data, error } = await createServiceRoleClient().rpc('purger_prospects_inactifs', {
    p_simulation: simulation,
  });

  if (error) {
    // 500 pour que le planificateur signale l'échec : une purge qui ne tourne
    // plus ne se voit pas autrement.
    return NextResponse.json({ erreur: error.message }, { status: 500 });
  }

  return NextResponse.json({ resultat: data });
}

export async function GET(request: Request) {
  return executer(request);
}

export async function POST(request: Request) {
  return executer(request);
}
