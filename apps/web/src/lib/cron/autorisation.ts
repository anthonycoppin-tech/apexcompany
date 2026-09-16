import 'server-only';

import crypto from 'node:crypto';

import { NextResponse } from 'next/server';

function secretValide(entete: string | null, attendu: string): boolean {
  if (!entete) return false;

  const recu = Buffer.from(entete.replace(/^Bearer /, ''), 'utf8');
  const bon = Buffer.from(attendu, 'utf8');

  // Comparaison à temps constant : une comparaison naïve renvoie plus vite
  // quand les premiers octets diffèrent, ce qui suffit à deviner le secret
  // caractère par caractère.
  return recu.length === bon.length && crypto.timingSafeEqual(recu, bon);
}

/**
 * Garde commune des tâches planifiées : `null` si l'appel est autorisé, la
 * réponse de refus sinon. Partagée pour qu'une tâche ajoutée ne réécrive pas sa
 * propre comparaison de secret — c'est là que se glisse la version naïve.
 */
export function refuserSiNonAutorise(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ erreur: 'Tâche non configurée' }, { status: 503 });
  }

  if (!secretValide(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 });
  }

  return null;
}
