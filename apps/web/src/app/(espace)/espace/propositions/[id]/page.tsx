import { notFound } from 'next/navigation';

import { formaterMontant } from '@apex/db';

import { dateHeure } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

import { BoutonPayer } from './bouton-payer';

const TYPES: Record<string, string> = {
  abonnement: 'Abonnement mensuel, résiliable à tout moment',
  accompagnement: 'Accompagnement, payé en une fois',
  formation: 'Formation, payée en une fois, accès illimité',
};

/**
 * `/espace/propositions/[id]` — ce que le formateur a proposé à l'issue de
 * l'audit.
 *
 * Page **authentifiée**, pas un lien à jeton. C'est le bénéfice direct du tunnel
 * inversé : le compte existe déjà quand la proposition est émise, donc la RLS
 * la protège sans qu'on ait à inventer un mécanisme de signature — et un lien
 * transféré à un tiers ne lui ouvre rien.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paiement?: string }>;
}) {
  const [{ id }, { paiement }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const { data: proposition } = await supabase
    .from('propositions')
    .select(
      'id, statut, montant_cents, devise, expire_le, created_at, formations(titre, description, type_produit, duree_acces_jours, modalite)',
    )
    .eq('id', id)
    .maybeSingle();

  // Introuvable et hors périmètre rendent le même 404 : la RLS ne distingue pas
  // les deux, et confirmer l'existence d'une proposition à quelqu'un qui n'y a
  // pas droit serait déjà en dire trop.
  if (!proposition || !proposition.formations) notFound();

  const formation = proposition.formations;
  const expiree =
    proposition.statut === 'expiree' ||
    (proposition.expire_le != null && new Date(proposition.expire_le) < new Date());
  const payable = proposition.statut === 'envoyee' && !expiree;

  return (
    <div className="max-w-2xl space-y-8">
      {paiement === 'annule' && (
        <p className="rounded border p-3 text-sm">
          Paiement interrompu — rien n’a été débité. Ta proposition reste valable.
        </p>
      )}

      <header className="space-y-2">
        <p className="text-sm text-neutral-500">
          Proposition du {dateHeure(proposition.created_at)}
        </p>
        <h1 className="text-2xl font-semibold">{formation.titre}</h1>
        <p className="text-sm text-neutral-600">
          {TYPES[formation.type_produit] ?? formation.type_produit} ·{' '}
          {formation.modalite === 'individuel' ? 'suivi individuel' : 'en groupe'}
        </p>
      </header>

      {formation.description && <p className="text-neutral-700">{formation.description}</p>}

      <div className="space-y-3 rounded border p-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-neutral-500">
            {formation.type_produit === 'abonnement' ? 'Par mois' : 'Montant'}
          </span>
          <span className="text-3xl font-semibold tabular-nums">
            {formaterMontant(proposition.montant_cents, proposition.devise)}
          </span>
        </div>

        <p className="text-sm text-neutral-600">
          {/* Une durée nulle veut dire illimité, jamais « non renseigné ». */}
          {formation.type_produit === 'accompagnement' && formation.duree_acces_jours
            ? `Accès pendant ${formation.duree_acces_jours} jours.`
            : formation.type_produit === 'abonnement'
              ? 'Accès tant que l’abonnement est actif. Résiliable depuis ton espace.'
              : 'Accès illimité, sans date de fin.'}
        </p>

        {proposition.expire_le && payable && (
          <p className="text-sm text-neutral-600">
            Cette proposition est valable jusqu’au {dateHeure(proposition.expire_le)}.
          </p>
        )}
      </div>

      {payable ? (
        <BoutonPayer propositionId={proposition.id} />
      ) : proposition.statut === 'acceptee' ? (
        <p className="rounded border p-3 text-sm">
          Proposition acceptée — ton accès est ouvert. Retrouve-le dans ton espace.
        </p>
      ) : (
        <p className="rounded border p-3 text-sm">
          Cette proposition n’est plus valable. Ton formateur peut t’en émettre une nouvelle.
        </p>
      )}
    </div>
  );
}
