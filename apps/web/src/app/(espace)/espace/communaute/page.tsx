import { BoutonLierDiscord } from '@/components/bouton-lier-discord';
import { Carte } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';

const MESSAGES: Record<string, string> = {
  ok: 'Ton compte Discord est connecté. Ton accès arrive dans la minute.',
  echec: "La connexion n'a pas abouti. Réessaie, rien n'a été perdu.",
  annule: 'Connexion annulée.',
};

/**
 * `/espace/communaute` — état de la liaison Discord.
 *
 * Le rôle n'est pas accordé par cette page : elle empile une demande dans
 * `discord_sync_queue`, que le worker consomme. D'où le « dans la minute »
 * plutôt qu'un « c'est fait » — une coupure Discord ne doit pas faire croire à
 * un accès qui n'existe pas, et inversement elle ne doit pas faire perdre
 * l'accès silencieusement.
 *
 * `discord_links` se lit ici par la RLS, sous la politique
 * `discord_links_lit_le_sien` : le client voit sa liaison, jamais celle d'un
 * autre.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ discord?: string }>;
}) {
  const { discord } = await searchParams;
  const supabase = await createClient();

  const { data: lien } = await supabase
    .from('discord_links')
    .select('discord_username, derniere_sync')
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-extrabold">Communauté Discord</h1>
        <p className="leading-relaxed text-encre-doux">
          Tout le contenu vit sur Discord : les échanges, les lives et les replays. Ton accès y est
          attribué automatiquement, et retiré à la fin de ton accès.
        </p>
      </div>

      {/* `role="status"` : le retour d'une liaison qui vient d'aboutir ou
          d'échouer doit être annoncé, pas seulement affiché. */}
      {discord && MESSAGES[discord] && (
        <p
          role="status"
          className={
            discord === 'ok'
              ? 'rounded-douce border border-accent bg-accent-doux p-4 text-sm font-medium text-accent'
              : 'rounded-douce border border-filet-fort bg-surface p-4 text-sm'
          }
        >
          {MESSAGES[discord]}
        </p>
      )}

      {lien ? (
        <Carte className="space-y-2">
          <p className="font-medium">
            Compte connecté{lien.discord_username ? ` : ${lien.discord_username}` : ''}.
          </p>
          <p className="text-sm text-encre-doux">
            Dernière synchronisation :{' '}
            {lien.derniere_sync
              ? new Date(lien.derniere_sync).toLocaleString('fr-FR')
              : 'en attente'}
          </p>
          <div className="pt-3">
            <BoutonLierDiscord libelle="Connecter un autre compte Discord" />
          </div>
        </Carte>
      ) : (
        <Carte className="space-y-4">
          <p className="leading-relaxed text-encre-doux">
            Aucun compte Discord connecté pour l’instant. Sans lui, ton accès ne peut pas être
            attribué.
          </p>
          <BoutonLierDiscord />
        </Carte>
      )}
    </div>
  );
}
