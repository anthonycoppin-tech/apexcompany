import Link from 'next/link';

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
        <p className="rounded border p-3 text-sm">
          Paiement reçu. Ton accès s’ouvre sur Discord dans la minute qui suit.
        </p>
      )}

      <h1 className="text-2xl font-semibold">Mon espace</h1>

      {proposition.data && (
        <section className="space-y-2 rounded border p-4">
          <h2 className="font-semibold">Une proposition t’attend</h2>
          <p className="text-sm text-neutral-600">
            {proposition.data.formations?.titre}
            {proposition.data.expire_le
              ? ` — valable jusqu’au ${dateCourte(proposition.data.expire_le)}`
              : ''}
          </p>
          <Link href={`/espace/propositions/${proposition.data.id}`} className="text-sm underline">
            Voir la proposition
          </Link>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Mes accès</h2>
        {inscriptions.data?.length ? (
          <ul className="divide-y rounded border text-sm">
            {inscriptions.data.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                <span className="font-medium">{i.formations?.titre ?? 'Formation'}</span>
                <span className="text-neutral-500">
                  {/* Une date nulle veut dire illimité, jamais « inconnue ». */}
                  {i.date_fin_acces ? `jusqu’au ${dateCourte(i.date_fin_acces)}` : 'accès illimité'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">
            Aucun accès ouvert pour l’instant. Il s’ouvre au paiement.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Mon prochain rendez-vous</h2>
        {rdv.data ? (
          <p className="text-sm">{dateHeure(rdv.data.debut)}</p>
        ) : (
          <p className="text-sm text-neutral-500">
            Aucun rendez-vous à venir. Les séances qui suivent ton achat s’organisent directement
            avec ton formateur, sur Discord.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Discord</h2>
        {lien.data ? (
          <p className="text-sm text-neutral-600">
            Compte connecté
            {lien.data.discord_username ? ` : ${lien.data.discord_username}` : ''}. Tout le contenu
            s’y trouve.
          </p>
        ) : (
          <p className="text-sm">
            <Link href="/espace/communaute" className="underline">
              Connecte ton compte Discord
            </Link>{' '}
            — sans lui, ton accès ne peut pas être attribué.
          </p>
        )}
      </section>
    </div>
  );
}
