import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formaterMontant } from '@apex/db';

import { EnTete, Pastille, Tableau, Vide, type Ton } from '@/components/admin';
import { dateCourte, dateHeure } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

const ETATS_INSCRIPTION: Record<string, Ton> = {
  active: 'bon',
  suspendue: 'attente',
  terminee: 'neutre',
  remboursee: 'neutre',
};

/**
 * `/admin/clients/[id]` — tout ce qu'on sait d'un client.
 *
 * C'est l'écran qu'on ouvre quand quelqu'un écrit « je n'ai pas eu mon accès »
 * ou « je veux ma facture ». Il rassemble ce qui vit dans six tables : accès,
 * commandes, encaissements, factures, abonnements et liaison Discord.
 *
 * **La liaison Discord est en haut**, avant l'argent, et ce n'est pas un hasard :
 * c'est la première chose à vérifier quand un accès n'est pas arrivé. Sans ligne
 * dans `discord_links`, le worker ne sait pas à qui accorder le rôle, et la
 * demande part en échec sans que personne ne le voie.
 *
 * Cet écran montre les montants, contrairement à la fiche formateur. C'est la
 * différence assumée entre les deux, et elle est garantie par les politiques —
 * pas par le fait qu'on ait pensé à masquer des colonnes.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profil } = await supabase
    .from('profiles')
    .select('id, prenom, nom, email, telephone, created_at')
    .eq('id', id)
    .maybeSingle();

  if (!profil) notFound();

  const [inscriptions, commandes, factures, abonnements, discord, lead] = await Promise.all([
    supabase
      .from('inscriptions')
      .select('id, statut, date_debut, date_fin_acces, formations(titre, type_produit)')
      .eq('user_id', id)
      .order('date_debut', { ascending: false }),
    supabase
      .from('orders')
      .select(
        'id, montant_cents, devise, statut, provider, provider_order_id, created_at, formations(titre), payments(statut, paid_at, provider_payment_id)',
      )
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('id, numero, emise_at, pdf_url, orders!inner(user_id, montant_cents, devise)')
      .eq('orders.user_id', id)
      .order('emise_at', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('id, statut, periode_fin, resiliation_demandee_le, formations(titre)')
      .eq('user_id', id),
    supabase
      .from('discord_links')
      .select('discord_user_id, discord_username, derniere_sync')
      .eq('user_id', id)
      .maybeSingle(),
    supabase.from('leads').select('id, statut').eq('user_id', id).maybeSingle(),
  ]);

  // Les notes se lisent APRÈS les inscriptions, et restreintes aux siennes.
  // La RLS ne suffit pas ici : elle ouvre au staff les notes de TOUS les
  // clients. Sans ce filtre, chaque fiche afficherait le suivi de tout le
  // monde — pas une fuite, mais une fiche qui ment, et sur cet écran-là c'est
  // aussi grave.
  const idsInscriptions = (inscriptions.data ?? []).map((i) => i.id);

  const notes = idsInscriptions.length
    ? await supabase
        .from('suivi_notes')
        .select('id, type, contenu, visible_client, created_at')
        .in('inscription_id', idsInscriptions)
        .order('created_at', { ascending: false })
    : { data: [] as never[] };

  const notesDuClient = notes.data ?? [];

  return (
    <>
      <EnTete
        titre={[profil.prenom, profil.nom].filter(Boolean).join(' ') || 'Sans nom'}
        description={`${profil.email}${profil.telephone ? ` · ${profil.telephone}` : ''} — compte créé le ${dateCourte(profil.created_at)}`}
        action={
          lead.data ? (
            <Link
              href={`/admin/crm/leads/${lead.data.id}`}
              className="text-sm text-accent hover:underline"
            >
              Voir sa fiche prospect →
            </Link>
          ) : undefined
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-encre-doux">Liaison Discord</h2>
        {discord.data ? (
          <div className="rounded-carte border border-filet bg-fond p-5 text-sm">
            <p>
              Compte connecté
              {discord.data.discord_username ? ` : ${discord.data.discord_username}` : ''}
              <span className="ml-2 font-mono text-xs text-encre-faible">
                {discord.data.discord_user_id}
              </span>
            </p>
            <p className="mt-1 text-encre-doux">
              Dernière synchronisation : {dateHeure(discord.data.derniere_sync)}
            </p>
          </div>
        ) : (
          // La première chose à vérifier quand un accès n'arrive pas.
          <div className="rounded-carte border border-filet bg-fond p-5 text-sm">
            <Pastille ton="probleme">Aucun compte Discord lié</Pastille>
            <p className="mt-2 text-encre-doux">
              Aucun rôle ne peut lui être attribué tant qu’il n’a pas connecté son Discord depuis
              son espace. C’est la cause la plus fréquente d’un accès qui n’arrive pas.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-encre-doux">Accès</h2>
        {inscriptions.data?.length ? (
          <div className="rounded-carte border border-filet bg-fond p-5">
            <Tableau colonnes={['Produit', 'Statut', 'Depuis', 'Jusqu’au']} largeurMin="38rem">
              {inscriptions.data.map((i) => (
                <tr key={i.id} className="border-b border-filet last:border-0">
                  <td className="py-2.5 pr-4">{i.formations?.titre ?? '—'}</td>
                  <td className="py-2.5 pr-4">
                    <Pastille ton={ETATS_INSCRIPTION[i.statut] ?? 'neutre'}>{i.statut}</Pastille>
                  </td>
                  <td className="py-2.5 pr-4 text-encre-doux">{dateCourte(i.date_debut)}</td>
                  <td className="py-2.5 text-encre-doux">
                    {i.date_fin_acces ? dateCourte(i.date_fin_acces) : 'illimité'}
                  </td>
                </tr>
              ))}
            </Tableau>
          </div>
        ) : (
          <Vide>Aucun accès ouvert.</Vide>
        )}
      </section>

      {abonnements.data?.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-encre-doux">Abonnements</h2>
          <div className="rounded-carte border border-filet bg-fond p-5">
            <Tableau
              colonnes={['Produit', 'Statut', 'Période jusqu’au', 'Résiliation demandée']}
              largeurMin="44rem"
            >
              {abonnements.data.map((a) => (
                <tr key={a.id} className="border-b border-filet last:border-0">
                  <td className="py-2.5 pr-4">{a.formations?.titre ?? '—'}</td>
                  <td className="py-2.5 pr-4">
                    <Pastille ton={a.statut === 'impayee' ? 'probleme' : 'neutre'}>
                      {a.statut}
                    </Pastille>
                  </td>
                  <td className="py-2.5 pr-4 text-encre-doux">{dateCourte(a.periode_fin)}</td>
                  <td className="py-2.5 text-encre-doux">
                    {a.resiliation_demandee_le ? dateCourte(a.resiliation_demandee_le) : '—'}
                  </td>
                </tr>
              ))}
            </Tableau>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-encre-doux">Commandes et encaissements</h2>
        {commandes.data?.length ? (
          <div className="rounded-carte border border-filet bg-fond p-5">
            <Tableau
              colonnes={['Date', 'Produit', 'Montant', 'Commande', 'Encaissement']}
              largeurMin="58rem"
            >
              {commandes.data.map((c) => {
                const paiement = c.payments?.[0];

                return (
                  <tr key={c.id} className="border-b border-filet align-top last:border-0">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-encre-doux">
                      {dateCourte(c.created_at)}
                    </td>
                    <td className="py-2.5 pr-4">{c.formations?.titre ?? '—'}</td>
                    <td className="py-2.5 pr-4 tabular-nums">
                      {formaterMontant(c.montant_cents, c.devise)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Pastille ton={c.statut === 'payee' ? 'bon' : 'attente'}>{c.statut}</Pastille>
                      <span className="mt-1 block font-mono text-xs text-encre-faible">
                        {c.provider_order_id}
                      </span>
                    </td>
                    <td className="py-2.5">
                      {paiement ? (
                        <>
                          <span className="text-encre-doux">{paiement.statut}</span>
                          <span className="mt-1 block font-mono text-xs text-encre-faible">
                            {paiement.provider_payment_id}
                          </span>
                        </>
                      ) : (
                        <span className="text-encre-faible">aucun</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Tableau>
          </div>
        ) : (
          <Vide>Aucune commande.</Vide>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-encre-doux">Factures</h2>
        {factures.data?.length ? (
          <div className="rounded-carte border border-filet bg-fond p-5">
            <Tableau colonnes={['Numéro', 'Émise le', 'Montant', 'PDF']} largeurMin="38rem">
              {factures.data.map((f) => (
                <tr key={f.id} className="border-b border-filet last:border-0">
                  <td className="py-2.5 pr-4 font-mono tabular-nums">{f.numero}</td>
                  <td className="py-2.5 pr-4 text-encre-doux">{dateCourte(f.emise_at)}</td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    {f.orders ? formaterMontant(f.orders.montant_cents, f.orders.devise) : '—'}
                  </td>
                  <td className="py-2.5">
                    {f.pdf_url ? (
                      <a href={f.pdf_url} className="text-accent hover:underline">
                        Ouvrir
                      </a>
                    ) : (
                      <span className="text-encre-faible">à générer</span>
                    )}
                  </td>
                </tr>
              ))}
            </Tableau>
          </div>
        ) : (
          <Vide>Aucune facture.</Vide>
        )}
      </section>

      {notesDuClient.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-encre-doux">Suivi du formateur</h2>
          <ul className="space-y-2">
            {notesDuClient.map((n) => (
              <li key={n.id} className="rounded-carte border border-filet bg-fond p-4 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs tracking-wide text-encre-faible uppercase">
                    {n.type}
                  </span>
                  <span className="text-xs text-encre-faible">
                    {n.visible_client ? 'Visible par le client' : 'Interne'} ·{' '}
                    {dateCourte(n.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{n.contenu}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm">
        <Link href="/admin/clients" className="text-accent hover:underline">
          ← Retour aux clients
        </Link>
      </p>
    </>
  );
}
