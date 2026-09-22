import { NextResponse, type NextRequest } from 'next/server';

import { factureHtml } from '@/lib/facture/modele';
import { regimeTva } from '@/lib/legal/societe';
import { createClient } from '@/lib/supabase/server';

/**
 * `/facture/[id]` — une facture, lisible et imprimable.
 *
 * Servie hors des groupes de routes parce que deux publics y viennent : le
 * client depuis `/espace/factures`, et le back-office. **C'est la RLS qui
 * tranche** — `invoices_client_lit_les_siennes` et `invoices_staff` —, sous la
 * session de la personne : pas de clé de service ici. Un identifiant qui n'est
 * pas le sien donne la même réponse qu'un identifiant qui n'existe pas.
 *
 * Un document HTML autonome plutôt qu'une page du site : sans en-tête ni
 * navigation, il s'imprime tel quel, et le navigateur l'enregistre en PDF.
 */
export async function GET(requete: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/connexion', requete.url));
  }

  const { data: facture } = await supabase
    .from('invoices')
    .select(
      'numero, emise_at, orders(montant_cents, devise, formations(titre, type_produit), profiles(prenom, nom, email))',
    )
    .eq('id', id)
    .maybeSingle();

  const commande = facture?.orders;
  if (!facture || !commande) {
    return new NextResponse('Facture introuvable.', { status: 404 });
  }

  const client = commande.profiles;
  const html = factureHtml({
    numero: facture.numero,
    emiseLe: facture.emise_at,
    client: {
      nom: [client?.prenom, client?.nom].filter(Boolean).join(' ') || null,
      email: client?.email ?? null,
    },
    produit: commande.formations?.titre ?? 'Programme',
    typeProduit: commande.formations?.type_produit ?? '',
    montantCents: commande.montant_cents,
    devise: commande.devise,
    tva: regimeTva(),
  });

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Un document personnel : jamais en cache partagé, jamais indexé.
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
