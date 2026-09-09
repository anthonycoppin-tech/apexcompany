import Link from 'next/link';

import { Carte, LISTE } from '@/components/ui';
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
  searchParams: Promise<{ paiement?: string }>;
}) {
  const { paiement } = await searchParams;
  const supabase = await createClient();

  const [inscriptions, proposition, rdv, lien] = await Promise.all([
    supabase
      .from('inscriptions')
      .select('id, statut, date_fin_acces, formations(titre, type_produit, modalite)')
      .eq('statut', 'active'),
    supabase
      .from('propositions')
      .select('id, expire_le, formations(titre)')
      .eq('statut', 'envoyee')
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
  ]);

  return (
    <div className="space-y-8">
      {paiement === 'ok' && (
        <p className="rounded-douce border border-accent bg-accent-doux p-4 text-sm font-medium text-accent">
          Paiement reçu. Ton accès s’ouvre sur Discord dans la minute qui suit.
        </p>
      )}

      <h1 className="text-3xl font-extrabold">Mon espace</h1>

      {/* La proposition passe avant tout le reste : c'est la seule chose de
          cette page qui attende une décision, et elle expire. */}
      {proposition.data && (
        <Carte className="space-y-3 border-accent bg-accent-doux">
          <h2 className="text-lg font-bold">Une proposition t’attend</h2>
          <p className="text-encre-doux">
            {proposition.data.formations?.titre}
            {proposition.data.expire_le
              ? ` — valable jusqu’au ${dateCourte(proposition.data.expire_le)}`
              : ''}
          </p>
          <Link
            href={`/espace/propositions/${proposition.data.id}`}
            className="inline-block text-sm font-semibold text-accent hover:underline"
          >
            Voir la proposition →
          </Link>
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
              Aucun accès ouvert pour l’instant. Il s’ouvre au paiement.
            </p>
          </Carte>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Mon prochain rendez-vous</h2>
          <Carte>
            {rdv.data ? (
              <p className="font-medium">{dateHeure(rdv.data.debut)}</p>
            ) : (
              <p className="leading-relaxed text-encre-doux">
                Aucun rendez-vous à venir. Les séances qui suivent ton achat s’organisent
                directement avec ton formateur, sur Discord.
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
                  Connecte ton compte Discord
                </Link>{' '}
                — sans lui, ton accès ne peut pas être attribué.
              </p>
            )}
          </Carte>
        </section>
      </div>
    </div>
  );
}
