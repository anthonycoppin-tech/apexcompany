import { NextResponse } from 'next/server';

import { getUserRoles } from '@/lib/auth/roles';
import { jourParis } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * `/api/rgpd/export?lead=<id>` — tout ce que la plateforme sait d'une personne.
 *
 * Le droit d'accès (RGPD, art. 15) : une personne peut demander une copie de
 * ses données, et la réponse est due sous un mois. Le fichier rassemble ce qui
 * vit dans une quinzaine de tables, **notes internes du formateur comprises** —
 * elles parlent d'elle, et le droit d'accès ne s'arrête pas à ce qu'on a
 * choisi de lui montrer. Ce qu'on retire avant d'envoyer, s'il y a lieu (le
 * droit des tiers), se décide en relisant le fichier, pas en l'omettant ici.
 *
 * On part du **prospect** : c'est la seule fiche qui existe pour tout le
 * monde, acheteur ou non. Le compte et les leads qui portent la même adresse
 * sont retrouvés à partir de lui.
 *
 * Garde propre à la route (aucun layout ne la protège), lecture avec la
 * session du staff : l'export ne voit pas plus que le back-office. Chaque
 * export laisse une trace dans l'audit, sans donnée personnelle.
 */
export async function GET(request: Request) {
  const roles = await getUserRoles();
  if (!roles.some((r) => r === 'admin' || r === 'owner')) {
    return new NextResponse('Accès refusé.', { status: 403 });
  }

  const leadId = new URL(request.url).searchParams.get('lead') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
    return new NextResponse('Prospect manquant : ?lead=<identifiant>.', { status: 400 });
  }

  const supabase = await createClient();

  const { data: lead } = await supabase
    .from('leads')
    .select('email, user_id, converti_user_id')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return new NextResponse('Prospect introuvable.', { status: 404 });

  const compte = lead.user_id ?? lead.converti_user_id;
  // Même adresse, casse comprise, mais **sans joker** : `_` et `%` sont
  // fréquents dans une adresse, et non échappés ils élargiraient la recherche
  // à d'autres personnes.
  const adresse = lead.email.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
  // Une lecture en échec fait échouer l'export entier : une copie légale à
  // laquelle il manque une rubrique sans le dire est pire que pas de copie.
  type Reponse<T> = { data: T[] | null; error?: { message: string } | null };
  const leurs = <T>(r: Reponse<T>) => {
    if (r.error) throw new Error(`Export RGPD incomplet : ${r.error.message}`);
    return r.data ?? [];
  };
  // L'identifiant interne ne dit rien à la personne : il ne sert qu'au dédoublonnage.
  const sansId = <T extends { id: string }>(ligne: T): Omit<T, 'id'> => {
    const copie: Partial<T> = { ...ligne };
    delete copie.id;
    return copie as Omit<T, 'id'>;
  };
  const sansDoublon = <T extends { id: string }>(lignes: T[]) => [
    ...new Map(lignes.map((l) => [l.id, l])).values(),
  ];

  const [leadsParAdresse, leadsParCompte] = await Promise.all([
    supabase.from('leads').select('*').ilike('email', adresse),
    compte
      ? supabase.from('leads').select('*').eq('user_id', compte)
      : Promise.resolve({ data: [] }),
  ]);
  const leads = sansDoublon([...leurs(leadsParAdresse), ...leurs(leadsParCompte)]);
  const idsLeads = leads.map((l) => l.id);

  const parCompte = async <T>(requete: (id: string) => PromiseLike<Reponse<T>>): Promise<T[]> =>
    compte ? leurs(await requete(compte)) : [];

  const [evenements, rendezVous, consentementsParAdresse, consentementsParCompte] =
    await Promise.all([
      supabase.from('lead_events').select('type, payload, created_at').in('lead_id', idsLeads),
      supabase
        .from('appointments')
        .select('debut, fin, statut, issue, compte_rendu, created_at')
        .in('lead_id', idsLeads),
      supabase
        .from('consents')
        .select('id, type, accorde, version_texte, ip, created_at')
        .ilike('email', adresse),
      compte
        ? supabase
            .from('consents')
            .select('id, type, accorde, version_texte, ip, created_at')
            .eq('user_id', compte)
        : Promise.resolve({ data: [] }),
    ]);

  const [profil, roles_, inscriptions, commandes, factures, abonnements, propositions, discord] =
    await Promise.all([
      parCompte((id) =>
        supabase.from('profiles').select('prenom, nom, email, telephone, created_at').eq('id', id),
      ),
      parCompte((id) => supabase.from('user_roles').select('role, granted_at').eq('user_id', id)),
      parCompte((id) =>
        supabase
          .from('inscriptions')
          .select('id, statut, date_debut, date_fin_acces, formations(titre)')
          .eq('user_id', id),
      ),
      parCompte((id) =>
        supabase
          .from('orders')
          .select(
            'montant_cents, devise, statut, provider, created_at, formations(titre), payments(montant_cents, statut, methode, paid_at, refunds(montant_cents, statut, motif, traite_at))',
          )
          .eq('user_id', id),
      ),
      parCompte((id) =>
        supabase
          .from('invoices')
          .select('numero, emise_at, orders!inner(user_id, montant_cents, devise)')
          .eq('orders.user_id', id),
      ),
      parCompte((id) =>
        supabase
          .from('subscriptions')
          .select('statut, periode_fin, resiliation_demandee_le, created_at, formations(titre)')
          .eq('user_id', id),
      ),
      parCompte((id) =>
        supabase
          .from('propositions')
          .select('statut, montant_cents, devise, expire_le, created_at, formations(titre)')
          .eq('user_id', id),
      ),
      parCompte((id) =>
        supabase
          .from('discord_links')
          .select('discord_user_id, discord_username, linked_at')
          .eq('user_id', id),
      ),
    ]);

  const idsInscriptions = inscriptions.map((i) => i.id);
  const notes = idsInscriptions.length
    ? leurs(
        await supabase
          .from('suivi_notes')
          .select('type, contenu, visible_client, created_at')
          .in('inscription_id', idsInscriptions),
      )
    : [];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const document = {
    export: {
      genere_le: new Date().toISOString(),
      objet: 'Copie des données personnelles (RGPD, article 15)',
      montants: 'en centimes',
    },
    compte: profil[0] ?? null,
    roles: roles_,
    prospects: leads,
    historique_commercial: leurs(evenements),
    rendez_vous: leurs(rendezVous),
    consentements: sansDoublon([
      ...leurs(consentementsParAdresse),
      ...leurs(consentementsParCompte),
    ]).map(sansId),
    acces: inscriptions.map(sansId),
    notes_de_suivi: notes,
    propositions,
    commandes,
    factures: factures.map(({ orders, ...f }) => ({
      ...f,
      montant_cents: orders?.montant_cents,
      devise: orders?.devise,
    })),
    abonnements,
    discord: discord[0] ?? null,
  };

  // La trace : qui a exporté quoi et quand, sans rien de ce qui a été exporté.
  // Clé de service pour cette seule écriture : aucune politique n'ouvre
  // `audit_logs` en écriture, et c'est ce qui rend le journal fiable.
  await createServiceRoleClient()
    .from('audit_logs')
    .insert({
      user_id: user?.id ?? null,
      action: 'EXPORT_RGPD',
      table_cible: 'leads',
      enregistrement_id: leadId,
    });

  return new NextResponse(JSON.stringify(document, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="donnees-personnelles-${jourParis()}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
