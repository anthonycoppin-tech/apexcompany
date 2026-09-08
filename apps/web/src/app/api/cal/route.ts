import crypto from 'node:crypto';

import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Webhook Cal.com — la seule source des lignes `appointments`.
 *
 * Sans lui, rien de ce qui a été demandé côté formateur n'existe : pas de
 * tableau de bord, pas de fiche client à jour, pas de statistique de rendez-vous
 * non honorés. C'est la raison pour laquelle la disponibilité des webhooks sur
 * le plan gratuit est une question bloquante et non un détail de confort.
 *
 * Trois garanties tenues ici :
 *
 * **La signature d'abord.** L'URL d'un webhook est publique : n'importe qui peut
 * y poster. Sans vérification, il suffirait de fabriquer une réservation pour
 * inscrire un faux rendez-vous au tableau de bord de Franck.
 *
 * **L'idempotence par `cal_booking_id`.** La colonne est UNIQUE, et un même
 * booking rejoué met à jour la ligne existante au lieu d'en créer une seconde.
 * Cal.com réessaie quand notre réponse tarde : c'est le fonctionnement normal.
 *
 * **Aucun échec silencieux.** Un rendez-vous qu'on n'arrive pas à rattacher à un
 * prospect est enregistré quand même, et la difficulté part dans
 * `automation_logs`. Perdre le rendez-vous serait pire que le rattacher mal.
 */

type Attendee = { email?: string; name?: string };

type PayloadCal = {
  uid?: string;
  bookingId?: number | string;
  startTime?: string;
  endTime?: string;
  attendees?: Attendee[];
  responses?: Record<string, { value?: unknown } | unknown>;
  cancellationReason?: string;
};

type EvenementCal = { triggerEvent?: string; payload?: PayloadCal };

/**
 * Comparaison à temps constant : une comparaison naïve renvoie plus vite quand
 * les premiers octets diffèrent, ce qui suffit à deviner une signature octet
 * par octet.
 */
function signatureValide(corps: string, entete: string | null, secret: string): boolean {
  if (!entete) return false;

  const attendue = crypto.createHmac('sha256', secret).update(corps).digest('hex');
  const recue = Buffer.from(entete.replace(/^sha256=/, ''), 'utf8');
  const calculee = Buffer.from(attendue, 'utf8');

  return recue.length === calculee.length && crypto.timingSafeEqual(recue, calculee);
}

export async function POST(request: Request) {
  const secret = process.env.CAL_WEBHOOK_SECRET;

  if (!secret) {
    // Ne jamais accepter un webhook non vérifiable parce que la configuration
    // manque : ce serait ouvrir l'écriture d'`appointments` à tout Internet le
    // jour d'un déploiement incomplet.
    return NextResponse.json({ erreur: 'Webhook non configuré' }, { status: 503 });
  }

  // Le corps brut, avant tout parsing : la signature porte sur les octets
  // reçus, et `JSON.parse` puis `JSON.stringify` ne les redonne pas à
  // l'identique.
  const corps = await request.text();

  if (!signatureValide(corps, request.headers.get('x-cal-signature-256'), secret)) {
    return NextResponse.json({ erreur: 'Signature invalide' }, { status: 401 });
  }

  let evenement: EvenementCal;
  try {
    evenement = JSON.parse(corps) as EvenementCal;
  } catch {
    return NextResponse.json({ erreur: 'Corps illisible' }, { status: 400 });
  }

  const { triggerEvent: type, payload } = evenement;
  const calBookingId = payload?.uid ?? (payload?.bookingId ? String(payload.bookingId) : null);

  if (!calBookingId || !payload?.startTime || !payload?.endTime) {
    return NextResponse.json({ erreur: 'Réservation incomplète' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Statut dérivé de l'événement Cal.com. Il décrit l'état de la RÉSERVATION,
  // pas ce qui s'est passé pendant l'appel : `appointments.issue`, que Franck
  // saisit après coup, reste la seule source de la statistique de no-show. Un
  // booking « confirmé » côté Cal.com peut très bien être un rendez-vous où
  // personne ne s'est présenté.
  const statut =
    type === 'BOOKING_CANCELLED'
      ? ('annule' as const)
      : type === 'BOOKING_RESCHEDULED'
        ? ('reporte' as const)
        : ('planifie' as const);

  // Rattachement au prospect par email — celui qu'il a saisi au formulaire.
  const email = payload.attendees?.find((a) => a.email)?.email?.toLowerCase() ?? null;

  const { data: lead } = email
    ? await supabase
        .from('leads')
        .select('id, assigned_to, statut')
        .ilike('email', email)
        .maybeSingle()
    : { data: null };

  // Franck reçoit tous les audits. `assigned_to` fait foi quand il est déjà
  // posé — c'est une affectation explicite, écrite une fois — et l'identifiant
  // configuré sert de défaut pour les réservations qui arrivent sans prospect
  // connu.
  const conseillerId = lead?.assigned_to ?? process.env.AUDIT_CONSEILLER_USER_ID ?? null;

  const { error: erreurRdv } = await supabase.from('appointments').upsert(
    {
      cal_booking_id: calBookingId,
      lead_id: lead?.id ?? null,
      debut: payload.startTime,
      fin: payload.endTime,
      statut,
      conseiller_id: conseillerId,
      notes: payload.cancellationReason ?? null,
    },
    { onConflict: 'cal_booking_id' },
  );

  if (erreurRdv) {
    // 500 volontaire : Cal.com réessaiera, et l'idempotence du `upsert` rend ce
    // réessai sans danger. Répondre 200 sur un échec ferait disparaître le
    // rendez-vous pour de bon.
    await supabase.from('automation_logs').insert({
      declencheur: 'cal.webhook',
      entite_type: 'appointments',
      statut: 'echec',
      details: { cal_booking_id: calBookingId, erreur: erreurRdv.message },
    });

    return NextResponse.json({ erreur: 'Enregistrement impossible' }, { status: 500 });
  }

  if (lead) {
    // Le prospect avance dans le pipeline, et l'audit fixe son affectation si
    // elle n'existait pas. Poser `assigned_to` ici est une écriture explicite,
    // pas une dérivation : le périmètre du formateur reste lu dans la colonne,
    // jamais reconstruit depuis l'historique des rendez-vous.
    const maj: { statut?: 'rdv'; assigned_to?: string } = {};

    if (statut === 'planifie' && lead.statut === 'nouveau') maj.statut = 'rdv';
    if (!lead.assigned_to && conseillerId) maj.assigned_to = conseillerId;

    if (Object.keys(maj).length > 0) {
      await supabase.from('leads').update(maj).eq('id', lead.id);
    }

    await supabase.from('lead_events').insert({
      lead_id: lead.id,
      type: `cal.${type ?? 'inconnu'}`,
      payload: { cal_booking_id: calBookingId, debut: payload.startTime },
    });
  } else {
    // Réservation sans prospect connu : quelqu'un a atteint la page Cal.com
    // sans passer par le formulaire, ou avec une autre adresse. Le rendez-vous
    // est gardé, et le rattachement se fera à la main depuis le back-office.
    await supabase.from('automation_logs').insert({
      declencheur: 'cal.webhook',
      entite_type: 'appointments',
      statut: 'ignore',
      details: { cal_booking_id: calBookingId, raison: 'Aucun prospect pour cet email', email },
    });
  }

  return NextResponse.json({ recu: true });
}
