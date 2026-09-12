import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Retour de l'OAuth Discord — le seul endroit où l'on apprend l'identifiant
 * Discord d'un client.
 *
 * C'est le maillon sans lequel le reste de la chaîne ne fonctionne pas : le
 * worker accorde un rôle à un `discord_user_id`, qu'il lit dans
 * `discord_links`. Tant que personne n'a lié son compte, empiler un `grant`
 * ne produit qu'une ligne en échec (« Compte Discord non lié »). D'où l'ordre
 * retenu — on écrit la liaison, puis on empile le rôle `invité`, dans cette
 * route et nulle part ailleurs.
 *
 * La liaison passe par le fournisseur Discord de Supabase Auth plutôt que par
 * un OAuth écrit à la main : on ne manipule ni secret client, ni échange de
 * jeton, ni stockage de `refresh_token`. Supabase attache l'identité au compte
 * existant, et il ne reste qu'à en projeter l'identifiant dans notre table.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const destination = new URL('/espace/communaute', url.origin);

  if (!code) {
    destination.searchParams.set('discord', 'annule');
    return NextResponse.redirect(destination);
  }

  const supabase = await createClient();
  const { error: erreurEchange } = await supabase.auth.exchangeCodeForSession(code);

  if (erreurEchange) {
    destination.searchParams.set('discord', 'echec');
    return NextResponse.redirect(destination);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const identite = user?.identities?.find((i) => i.provider === 'discord');

  // `identity_data.provider_id` est l'identifiant numérique du compte Discord,
  // celui que l'API attend dans `PUT /guilds/{guild}/members/{user}/roles/{role}`.
  // `identity_data.sub` porte la même valeur ; on prend le premier disponible.
  const discordUserId =
    (identite?.identity_data?.provider_id as string | undefined) ??
    (identite?.identity_data?.sub as string | undefined);

  if (!user || !discordUserId) {
    destination.searchParams.set('discord', 'echec');
    return NextResponse.redirect(destination);
  }

  const admin = createServiceRoleClient();

  // `upsert` sur user_id : relier deux fois le même compte est un geste normal
  // — quelqu'un qui change de compte Discord, ou qui reclique par doute — et
  // doit rester sans conséquence.
  const { error: erreurLien } = await admin.from('discord_links').upsert(
    {
      user_id: user.id,
      discord_user_id: discordUserId,
      discord_username: (identite?.identity_data?.user_name as string | undefined) ?? null,
      derniere_sync: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (erreurLien) {
    destination.searchParams.set('discord', 'echec');
    return NextResponse.redirect(destination);
  }

  // Le rôle `invité` : celui que tout compte reçoit à l'entrée, avant tout
  // achat. Les rôles de produit viennent ensuite, un par formation payée, et
  // par le même chemin — la file, jamais un appel direct à l'API Discord.
  const roleInvite = process.env.DISCORD_ROLE_INVITE_ID;

  if (roleInvite) {
    const { data: dejaEmpile } = await admin
      .from('discord_sync_queue')
      .select('id')
      .eq('user_id', user.id)
      .eq('role_id', roleInvite)
      .eq('action', 'grant')
      .in('statut', ['en_attente', 'en_cours', 'reussi'])
      .limit(1);

    // Reclic sur « connecter mon Discord » : on ne réempile pas un rôle déjà
    // accordé ou déjà en file. Le worker est idempotent, mais une file qui
    // grossit à chaque clic rend son diagnostic illisible.
    if (!dejaEmpile?.length) {
      await admin.from('discord_sync_queue').insert({
        user_id: user.id,
        action: 'grant',
        role_id: roleInvite,
      });
    }
  } else {
    // La liaison a réussi, seule la configuration manque. Ne pas faire échouer
    // la page pour autant, mais laisser une trace lisible dans /admin/logs :
    // un accès perdu en silence est exactement ce que la file existe pour
    // éviter.
    await admin.from('automation_logs').insert({
      declencheur: 'discord.liaison',
      entite_type: 'discord_links',
      entite_id: user.id,
      statut: 'echec',
      details: { raison: 'DISCORD_ROLE_INVITE_ID non configuré' },
    });

    // Et le dire. Annoncer « ton accès arrive dans la minute » alors qu'on
    // vient d'enregistrer un échec, c'est envoyer quelqu'un attendre un rôle
    // que personne n'a demandé — et, comme la liaison existe désormais, il ne
    // pourra même pas rejouer le parcours pour se rattraper.
    destination.searchParams.set('discord', 'sans-role');
    return NextResponse.redirect(destination);
  }

  destination.searchParams.set('discord', 'ok');
  return NextResponse.redirect(destination);
}
