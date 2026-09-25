import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formaterMontant } from '@apex/db';

import { MessageURL } from '@/components/message-url';
import { AvertissementRisque, Carte, Conteneur, Section } from '@/components/ui';
import { PARAM, messageConstant } from '@/lib/messages/catalogue';
import { lireAccesExistant } from '@/lib/paiement/acces-existant';
import { dureeAcces, libelleAbonnement } from '@/lib/paiement/libelles';
import { createClient } from '@/lib/supabase/server';

import { BoutonRenvoyer } from './bouton-renvoyer';
import { FormulaireSouscription } from './formulaire';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from('formations').select('titre').eq('slug', slug).maybeSingle();

  return { title: data ? `Acheter — ${data.titre}` : 'Acheter' };
}

/**
 * `/formations/[slug]/souscrire` — la vente en self-service.
 *
 * Ouverte à l'abonnement le 8 septembre 2026, puis à tout le catalogue le
 * 25 septembre à la demande du client : formations et accompagnements
 * s'achètent aussi au prix affiché. L'échange d'orientation reste proposé sur
 * la fiche, pour qui veut être conseillé avant d'acheter.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ slug }, parametres] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  // `actif` filtré explicitement : la RLS laisse le staff lire les brouillons
  // (les politiques se combinent en OU), et cet écran ouvre un paiement réel.
  // L'action le revérifie de son côté — ici on évite surtout d'afficher un
  // bouton « souscrire » sur un produit qui n'est pas en vente.
  const { data: formation } = await supabase
    .from('formations')
    .select('id, slug, titre, description, prix_cents, devise, type_produit, duree_acces_jours')
    .eq('slug', slug)
    .eq('actif', true)
    .maybeSingle();

  if (!formation) notFound();

  const abonnement = formation.type_produit === 'abonnement';
  const libellePrix = abonnement
    ? libelleAbonnement(formation.duree_acces_jours)
    : formation.duree_acces_jours
      ? `Paiement unique — accès ${dureeAcces(formation.duree_acces_jours)}`
      : 'Paiement unique — accès illimité';

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const emailAVerifier = Boolean(user) && !user?.email_confirmed_at;
  const acces = user ? await lireAccesExistant(supabase, user.id, formation) : null;

  return (
    <Section>
      <Conteneur largeur="etroite" className="space-y-8 px-0">
        <div className="space-y-3">
          <Link href={`/formations/${slug}`} className="text-sm text-encre-doux hover:underline">
            ← Retour à la fiche
          </Link>
          <h1 className="text-3xl font-extrabold">{formation.titre}</h1>
          {formation.description && (
            <p className="leading-relaxed text-encre-doux">{formation.description}</p>
          )}
        </div>

        <MessageURL message={messageConstant(parametres[PARAM])} />

        <Carte className="space-y-6">
          <div className="flex items-baseline justify-between gap-4 border-b border-filet pb-5">
            <span className="text-sm text-encre-doux">{libellePrix}</span>
            <span className="font-titre text-3xl font-extrabold tabular-nums">
              {formaterMontant(formation.prix_cents, formation.devise)}
            </span>
          </div>

          {/* L'email doit être vérifié avant de payer — non bloquant à
              l'inscription, bloquant ici. Une facture qui part vers une adresse
              non vérifiée est une facture qu'on ne peut pas prouver avoir
              envoyée. */}
          {acces?.bloque ? (
            <p className="text-sm leading-relaxed">
              {acces.raison}{' '}
              <Link href="/espace/factures" className="font-semibold text-accent hover:underline">
                Voir mes factures
              </Link>
            </p>
          ) : emailAVerifier ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="font-semibold">Vérifiez votre adresse email</h2>
                <p className="text-sm leading-relaxed text-encre-doux">
                  Votre compte est créé. Nous vous avons envoyé un lien de vérification à{' '}
                  <span className="font-medium text-encre">{user?.email}</span>. Cliquez dessus,
                  puis revenez sur cette page pour finaliser votre souscription — c’est la garantie
                  que vos factures vous parviennent bien.
                </p>
              </div>
              <BoutonRenvoyer />
            </div>
          ) : (
            <FormulaireSouscription
              slug={slug}
              typeProduit={formation.type_produit}
              connecte={Boolean(user)}
              libelleBouton={user ? 'Payer et ouvrir mon accès' : 'Créer mon compte et payer'}
            />
          )}
        </Carte>

        <div className="space-y-2 text-sm text-encre-doux">
          <p className="font-medium text-encre">Ce que vous obtenez tout de suite</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>L’accès au salon Discord du programme, attribué dès l’encaissement.</li>
            <li>Votre facture, disponible dans votre espace.</li>
            {abonnement ? (
              <li>La résiliation en deux clics, sans avoir à écrire à qui que ce soit.</li>
            ) : (
              <li>
                Un doute sur le bon programme ?{' '}
                <Link href="/qualification" className="text-accent hover:underline">
                  Faites d’abord le point avec nous
                </Link>
                .
              </li>
            )}
          </ul>
        </div>

        <AvertissementRisque />
      </Conteneur>
    </Section>
  );
}
