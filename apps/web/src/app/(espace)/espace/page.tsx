import Link from 'next/link';

import { formaterMontant } from '@apex/db';

import { MessageURL } from '@/components/message-url';
import { Bouton, Carte, LISTE } from '@/components/ui';
import { PARAM, messagePaiement } from '@/lib/messages/catalogue';
import { lireEtatPaiement } from '@/lib/messages/preuves';
import { dateCourte, dateHeure } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

/**
 * `/espace` — ce que le client voit en arrivant.
 *
 * Trois choses, dans cet ordre : ses accès, ce qu'on attend de lui, et son
 * prochain rendez-vous. Un client peut **cumuler plusieurs accès** — abonnement
 * communauté et accompagnement, par exemple — avec deux rôles Discord et deux
 * dates de fin indépendantes : l'écran le prévoit dès la première ligne plutôt
 * que d'afficher « votre formation » au singulier.
 *
 * Aucun contenu de formation ici, et c'est le principe de la révision 3 : les
 * cours, les lives et les replays vivent sur Discord.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [parametres, supabase, preuve] = await Promise.all([
    searchParams,
    createClient(),
    lireEtatPaiement(),
  ]);

  const [inscriptions, proposition, rdv, lien, notes] = await Promise.all([
    supabase
      .from('inscriptions')
      .select('id, statut, date_fin_acces, formations(titre, type_produit, modalite)')
      .eq('statut', 'active'),
    supabase
      .from('propositions')
      .select('id, expire_le, montant_cents, devise, formations(titre)')
      .eq('statut', 'envoyee')
      // Une proposition échue garde son statut en base : c'est la date qui
      // fait foi. L'afficher comme « en attente » ferait cliquer pour rien.
      .or(`expire_le.is.null,expire_le.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('appointments')
      .select('debut, statut')
      .gte('debut', new Date().toISOString())
      .order('debut')
      .limit(1)
      .maybeSingle(),
    supabase.from('discord_links').select('discord_username').maybeSingle(),
    // La RLS ne rend que les notes marquées visibles, sur ses propres
    // inscriptions (`suivi_notes_client_lit_les_visibles`). Les notes internes
    // du formateur ne quittent jamais la base pour ce compte.
    supabase
      .from('suivi_notes')
      .select('id, type, contenu, created_at, inscription_id, inscriptions(formations(titre))')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const toutesNotes = notes.data ?? [];
  const objectifs = toutesNotes.filter(
    (n, i) =>
      n.type === 'objectif' &&
      toutesNotes.findIndex(
        (m) => m.type === 'objectif' && m.inscription_id === n.inscription_id,
      ) === i,
  );
  const retours = toutesNotes.filter((n) => n.type !== 'objectif').slice(0, 5);

  return (
    <div className="space-y-8">
      <MessageURL message={messagePaiement(parametres[PARAM], preuve)} />

      <h1 className="text-3xl font-extrabold">Mon espace</h1>

      {/* La proposition passe avant tout le reste : c'est la seule chose de
          cette page qui attende une décision, et elle expire. */}
      {proposition.data && (
        <Carte className="flex flex-wrap items-center justify-between gap-4 border-accent bg-accent-doux">
          <div className="space-y-1">
            <h2 className="text-lg font-bold">Une proposition vous attend</h2>
            <p className="text-encre-doux">
              {proposition.data.formations?.titre} ·{' '}
              <span className="font-semibold text-encre tabular-nums">
                {formaterMontant(proposition.data.montant_cents, proposition.data.devise)}
              </span>
              {proposition.data.expire_le
                ? ` — valable jusqu’au ${dateCourte(proposition.data.expire_le)}`
                : ''}
            </p>
          </div>
          {/* Un vrai bouton, pas un lien discret : c'est l'action qui a
              échappé à tout le monde pendant la présentation du 25 septembre. */}
          <Bouton href={`/espace/propositions/${proposition.data.id}`}>Voir et régler</Bouton>
        </Carte>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Mes accès</h2>
        {inscriptions.data?.length ? (
          <ul className={LISTE}>
            {inscriptions.data.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-3 p-4">
                <span className="font-medium">{i.formations?.titre ?? 'Formation'}</span>
                <span className="text-sm text-encre-doux">
                  {/* Une date nulle veut dire illimité, jamais « inconnue ». */}
                  {i.date_fin_acces ? `jusqu’au ${dateCourte(i.date_fin_acces)}` : 'accès illimité'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Carte>
            <p className="text-encre-doux">
              Aucun accès ouvert pour l’instant. Il s’ouvre au paiement — d’une{' '}
              <Link href="/espace/propositions" className="text-accent hover:underline">
                proposition
              </Link>{' '}
              ou d’un{' '}
              <Link href="/formations" className="text-accent hover:underline">
                programme du catalogue
              </Link>
              .
            </p>
          </Carte>
        )}
      </section>

      {toutesNotes.length > 0 && (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Mon suivi</h2>
            <p className="text-sm text-encre-doux">
              Les objectifs et les retours que votre formateur partage avec vous.
            </p>
          </div>
          {objectifs.map((o) => (
            <Carte key={o.id} className="space-y-1 border-accent/30 bg-accent-doux">
              <p className="text-xs font-semibold tracking-wide text-encre-doux uppercase">
                Objectif en cours · {o.inscriptions?.formations?.titre ?? 'Accompagnement'}
              </p>
              <p className="whitespace-pre-wrap">{o.contenu}</p>
              <p className="text-xs text-encre-doux">Fixé le {dateCourte(o.created_at)}</p>
            </Carte>
          ))}
          {retours.length > 0 && (
            <ul className={LISTE}>
              {retours.map((r) => (
                <li key={r.id} className="space-y-1 p-4 text-sm">
                  <p className="text-xs text-encre-doux">
                    {r.type === 'retour' ? 'Retour de séance' : 'Note'} · {dateCourte(r.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap">{r.contenu}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Mon prochain rendez-vous</h2>
          <Carte>
            {rdv.data ? (
              <p className="font-medium">{dateHeure(rdv.data.debut)}</p>
            ) : (
              <p className="leading-relaxed text-encre-doux">
                Aucun rendez-vous à venir. Les séances qui suivent votre achat s’organisent
                directement avec votre formateur, sur Discord.
              </p>
            )}
          </Carte>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Discord</h2>
          <Carte>
            {lien.data ? (
              <p className="leading-relaxed text-encre-doux">
                Compte connecté
                {lien.data.discord_username ? ` : ${lien.data.discord_username}` : ''}. Tout le
                contenu s’y trouve.
              </p>
            ) : (
              <p className="leading-relaxed">
                <Link href="/espace/communaute" className="font-semibold text-accent underline">
                  Connectez votre compte Discord
                </Link>{' '}
                — sans lui, votre accès ne peut pas être attribué.
              </p>
            )}
          </Carte>
        </section>
      </div>
    </div>
  );
}
