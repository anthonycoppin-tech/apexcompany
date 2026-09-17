import { NextResponse } from 'next/server';

import { getUserRoles } from '@/lib/auth/roles';
import { SOURCES, libelleStatut } from '@/lib/crm/pipeline';
import { date, montant, versCsv, type Cellule } from '@/lib/export/csv';
import { bornesDesJours, jourParis } from '@/lib/format';
import { nomComplet } from '@/lib/formateur/suivi';
import {
  METHODES,
  PRESTATAIRES,
  STATUTS_PAIEMENT,
  STATUTS_REMBOURSEMENT,
} from '@/lib/paiement/libelles';
import { libelle } from '@/lib/qualification/questionnaire';
import { createClient } from '@/lib/supabase/server';

/**
 * `/api/exports/[type]?du=AAAA-MM-JJ&au=AAAA-MM-JJ` — un CSV pour la
 * comptabilité ou le suivi commercial.
 *
 * **La garde est ici, et seulement ici.** Une route d'API n'hérite d'aucun
 * layout : placée sous `(admin)`, elle resterait ouverte à qui la connaît.
 * La RLS protège les lignes derrière — un client n'y lirait que les siennes —
 * mais un export de prospects n'a rien à faire hors de l'équipe.
 *
 * Lu avec la session de l'admin, pas la clé de service : ce que la RLS ouvre
 * au staff suffit, et un export ne doit jamais voir plus que l'écran.
 *
 * Les dates s'entendent **à Paris**, bornes incluses : « du 1er au 30 » est ce
 * que le comptable demande, pas une fenêtre UTC.
 */

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

type Export = {
  fichier: string;
  entetes: string[];
  lignes: (
    supabase: Awaited<ReturnType<typeof createClient>>,
    debut: string,
    fin: string,
  ) => Promise<Cellule[][]>;
};

const personne = (p: { prenom: string | null; nom: string | null; email?: string } | null) =>
  p ? nomComplet(p, p.email ?? '') : '';

const EXPORTS: Record<string, Export> = {
  paiements: {
    fichier: 'paiements',
    entetes: [
      'Date',
      'Client',
      'Email',
      'Produit',
      'Montant',
      'Devise',
      'Statut',
      'Prestataire',
      'Moyen',
      'Référence paiement',
      'Référence commande',
    ],
    async lignes(supabase, debut, fin) {
      const { data, error } = await supabase
        .from('payments')
        .select(
          'paid_at, created_at, montant_cents, devise, statut, provider, methode, provider_payment_id, orders(provider_order_id, formations(titre), profiles(prenom, nom, email))',
        )
        .gte('created_at', debut)
        .lt('created_at', fin)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map((p) => [
        date(p.paid_at ?? p.created_at),
        personne(p.orders?.profiles ?? null),
        p.orders?.profiles?.email,
        p.orders?.formations?.titre,
        montant(p.montant_cents),
        p.devise,
        STATUTS_PAIEMENT[p.statut] ?? p.statut,
        PRESTATAIRES[p.provider] ?? p.provider,
        p.methode ? (METHODES[p.methode] ?? p.methode) : null,
        p.provider_payment_id,
        p.orders?.provider_order_id,
      ]);
    },
  },

  remboursements: {
    fichier: 'remboursements',
    entetes: [
      'Demandé le',
      'Exécuté le',
      'Client',
      'Email',
      'Produit',
      'Montant',
      'Statut',
      'Motif',
      'Référence remboursement',
      'Référence paiement',
    ],
    async lignes(supabase, debut, fin) {
      const { data, error } = await supabase
        .from('refunds')
        .select(
          'created_at, traite_at, montant_cents, statut, motif, provider_refund_id, payments(provider_payment_id, orders(formations(titre), profiles(prenom, nom, email)))',
        )
        .gte('created_at', debut)
        .lt('created_at', fin)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map((r) => [
        date(r.created_at),
        date(r.traite_at),
        personne(r.payments?.orders?.profiles ?? null),
        r.payments?.orders?.profiles?.email,
        r.payments?.orders?.formations?.titre,
        montant(r.montant_cents),
        STATUTS_REMBOURSEMENT[r.statut] ?? r.statut,
        r.motif,
        r.provider_refund_id,
        r.payments?.provider_payment_id,
      ]);
    },
  },

  factures: {
    fichier: 'factures',
    entetes: [
      'Numéro',
      'Émise le',
      'Client',
      'Email',
      'Objet',
      'Montant',
      'Devise',
      'Référence commande',
    ],
    async lignes(supabase, debut, fin) {
      const { data, error } = await supabase
        .from('invoices')
        .select(
          'numero, emise_at, orders(montant_cents, devise, provider_order_id, formations(titre), profiles(prenom, nom, email))',
        )
        .gte('emise_at', debut)
        .lt('emise_at', fin)
        .order('numero');
      if (error) throw error;
      return (data ?? []).map((f) => [
        f.numero,
        date(f.emise_at),
        personne(f.orders?.profiles ?? null),
        f.orders?.profiles?.email,
        f.orders?.formations?.titre,
        montant(f.orders?.montant_cents),
        f.orders?.devise,
        f.orders?.provider_order_id,
      ]);
    },
  },

  prospects: {
    fichier: 'prospects',
    entetes: [
      'Arrivé le',
      'Prénom',
      'Nom',
      'Email',
      'Téléphone',
      'Réseau',
      'Statut',
      'Budget',
      'Blocage',
      'Niveau',
      'Délai visé',
      'Affecté à',
    ],
    async lignes(supabase, debut, fin) {
      const { data, error } = await supabase
        .from('leads')
        .select(
          'created_at, prenom, nom, email, telephone, source, statut, tranche_budget, blocage, niveau_trading, delai_objectif, profiles!leads_assigned_to_fkey(prenom, nom)',
        )
        .gte('created_at', debut)
        .lt('created_at', fin)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map((l) => [
        date(l.created_at),
        l.prenom,
        l.nom,
        l.email,
        l.telephone,
        SOURCES[l.source] ?? l.source,
        libelleStatut(l.statut),
        libelle('tranche_budget', l.tranche_budget),
        libelle('blocage', l.blocage),
        libelle('niveau_trading', l.niveau_trading),
        libelle('delai_objectif', l.delai_objectif),
        personne(l.profiles),
      ]);
    },
  },
};

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const roles = await getUserRoles();
  if (!roles.some((r) => r === 'admin' || r === 'owner')) {
    return new NextResponse('Accès refusé.', { status: 403 });
  }

  const { type } = await params;
  const exportChoisi = EXPORTS[type];
  if (!exportChoisi) return new NextResponse('Export inconnu.', { status: 404 });

  const url = new URL(request.url);
  const aujourdhui = jourParis();
  const du = url.searchParams.get('du') ?? `${aujourdhui.slice(0, 8)}01`;
  const au = url.searchParams.get('au') ?? aujourdhui;
  if (!JOUR.test(du) || !JOUR.test(au) || du > au) {
    return new NextResponse('Période invalide : du=AAAA-MM-JJ, au=AAAA-MM-JJ, du ≤ au.', {
      status: 400,
    });
  }

  const { debut, fin } = bornesDesJours(du, au);
  const supabase = await createClient();
  const lignes = await exportChoisi.lignes(supabase, debut, fin);

  return new NextResponse(versCsv(exportChoisi.entetes, lignes), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportChoisi.fichier}-${du}-au-${au}.csv"`,
      // Des données personnelles : aucun cache intermédiaire ne doit les garder.
      'Cache-Control': 'no-store',
    },
  });
}
