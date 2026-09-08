import crypto from 'node:crypto';

import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Déclencheur quotidien de la révocation des accès expirés.
 *
 * Le travail est entièrement fait par `revoquer_acces_expires()` : cette route
 * n'est qu'une porte d'entrée pour un planificateur. Elle ne contient aucune
 * logique métier, et c'est délibéré — une règle d'accès écrite ici échapperait
 * aux tests de `supabase/tests/`.
 *
 * **Pourquoi une route et pas `pg_cron`.** `pg_cron` serait plus robuste : la
 * tâche tournerait dans la base, sans dépendre de la disponibilité du site.
 * Deux raisons de ne pas le faire maintenant. D'abord la boucle de vérification
 * locale, `npm run db:check`, retire les `create extension` — la planification
 * ne serait donc jamais rejouée hors ligne, et une migration qui ne s'exécute
 * pas pareil en local et en production est une migration qu'on ne relit plus.
 * Ensuite, la fonction est appelable des deux façons : basculer sur `pg_cron`
 * le jour venu ne demande qu'un `cron.schedule`, sans toucher au reste.
 *
 * En attendant, n'importe quel planificateur fait l'affaire — Vercel Cron,
 * GitHub Actions, une tâche système.
 */
function secretValide(entete: string | null, attendu: string): boolean {
  if (!entete) return false;

  const recu = Buffer.from(entete.replace(/^Bearer /, ''), 'utf8');
  const bon = Buffer.from(attendu, 'utf8');

  // Comparaison à temps constant : une comparaison naïve renvoie plus vite
  // quand les premiers octets diffèrent, ce qui suffit à deviner le secret
  // caractère par caractère.
  return recu.length === bon.length && crypto.timingSafeEqual(recu, bon);
}

async function executer(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ erreur: 'Tâche non configurée' }, { status: 503 });
  }

  if (!secretValide(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 });
  }

  const { data, error } = await createServiceRoleClient().rpc('revoquer_acces_expires');

  if (error) {
    // 500 pour que le planificateur signale l'échec plutôt que de le passer
    // sous silence. Une révocation qui ne tourne plus ne se voit pas autrement :
    // personne ne signale qu'il a encore accès.
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
