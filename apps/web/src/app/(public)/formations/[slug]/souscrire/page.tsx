import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { formaterMontant } from '@apex/db';

import { AvertissementRisque, Carte, Conteneur, Section } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';

import { BoutonRenvoyer } from './bouton-renvoyer';
import { FormulaireSouscription } from './formulaire';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from('formations').select('titre').eq('slug', slug).maybeSingle();

  return { title: data ? `Souscrire — ${data.titre}` : 'Souscrire' };
}

/**
 * `/formations/[slug]/souscrire` — la vente en self-service.
 *
 * Réservée aux produits de type `abonnement`, tranché le 8 septembre 2026 : un
 * abonnement mensuel s'achète sans rendez-vous, imposer un audit pour y
 * souscrire coûterait la majorité des inscriptions. Les accompagnements et les
 * formations, eux, continuent de passer par l'échange d'orientation — le panier
 * justifie qu'on vérifie que le produit correspond avant de vendre.
 *
 * Un produit qui n'est pas un abonnement est renvoyé vers sa fiche plutôt que
 * vers un 404 : l'adresse existe, c'est ce produit-là qui ne s'achète pas ici.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ verifier?: string; paiement?: string }>;
}) {
  const [{ slug }, { verifier, paiement }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const { data: formation } = await supabase
    .from('formations')
    .select('id, slug, titre, description, prix_cents, devise, type_produit')
    .eq('slug', slug)
    .maybeSingle();

  if (!formation) notFound();
  if (formation.type_produit !== 'abonnement') redirect(`/formations/${slug}`);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const emailAVerifier = Boolean(user) && !user?.email_confirmed_at;

  return (
    <Section>
      <Conteneur className="max-w-xl space-y-8 px-0">
        <div className="space-y-3">
          <Link href={`/formations/${slug}`} className="text-sm text-encre-doux hover:underline">
            ← Retour à la fiche
          </Link>
          <h1 className="text-3xl font-extrabold">{formation.titre}</h1>
          {formation.description && (
            <p className="leading-relaxed text-encre-doux">{formation.description}</p>
          )}
        </div>

        {paiement === 'annule' && (
          <p className="rounded-carte border border-filet p-4 text-sm">
            Paiement interrompu — rien n’a été débité.
          </p>
        )}

        <Carte className="space-y-6">
          <div className="flex items-baseline justify-between gap-4 border-b border-filet pb-5">
            <span className="text-sm text-encre-doux">Par mois</span>
            <span className="font-titre text-3xl font-extrabold tabular-nums">
              {formaterMontant(formation.prix_cents, formation.devise)}
            </span>
          </div>

          {/* L'email doit être vérifié avant de payer — non bloquant à
              l'inscription, bloquant ici. Une facture qui part vers une adresse
              non vérifiée est une facture qu'on ne peut pas prouver avoir
              envoyée. */}
          {emailAVerifier || verifier ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="font-semibold">Vérifie ton adresse email</h2>
                <p className="text-sm leading-relaxed text-encre-doux">
                  Ton compte est créé. Nous t’avons envoyé un lien de vérification à{' '}
                  <span className="font-medium text-encre">{user?.email}</span>. Clique dessus, puis
                  reviens sur cette page pour finaliser ta souscription — c’est la garantie que tes
                  factures arrivent bien chez toi.
                </p>
              </div>
              <BoutonRenvoyer />
            </div>
          ) : (
            <FormulaireSouscription
              slug={slug}
              connecte={Boolean(user)}
              libelleBouton={user ? 'Payer et ouvrir mon accès' : 'Créer mon compte et payer'}
            />
          )}
        </Carte>

        <div className="space-y-2 text-sm text-encre-doux">
          <p className="font-medium text-encre">Ce que tu obtiens tout de suite</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>L’accès au salon Discord du programme, attribué dès l’encaissement.</li>
            <li>Ta facture, disponible dans ton espace.</li>
            <li>La résiliation en deux clics, sans avoir à écrire à qui que ce soit.</li>
          </ul>
        </div>

        <AvertissementRisque />
      </Conteneur>
    </Section>
  );
}
