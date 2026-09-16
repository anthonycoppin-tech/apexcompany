import { BoutonLierDiscord } from '@/components/bouton-lier-discord';
import { MessageURL } from '@/components/message-url';
import { Carte } from '@/components/ui';
import { PARAM, messageDiscord } from '@/lib/messages/catalogue';
import { lireEtatDiscord } from '@/lib/messages/preuves';
import { createClient } from '@/lib/supabase/server';

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
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [parametres, supabase, preuve] = await Promise.all([
    searchParams,
    createClient(),
    lireEtatDiscord(),
  ]);

  const { data: lien } = await supabase
    .from('discord_links')
    .select('discord_username, derniere_sync')
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-extrabold">Communauté Discord</h1>
        <p className="leading-relaxed text-encre-doux">
          Tout le contenu vit sur Discord : les échanges, les lives et les replays. Votre accès y
          est attribué automatiquement, et retiré à la fin de votre accès.
        </p>
      </div>

      <MessageURL message={messageDiscord(parametres[PARAM], preuve)} />

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
            Aucun compte Discord connecté pour l’instant. Sans lui, votre accès ne peut pas être
            attribué.
          </p>
          <BoutonLierDiscord />
        </Carte>
      )}
    </div>
  );
}
