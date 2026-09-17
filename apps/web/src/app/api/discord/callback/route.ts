import { NextResponse } from 'next/server';

import { PARAM } from '@/lib/messages/catalogue';
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
/**
 * Le pseudo Discord, tel qu'il s'affiche dans l'espace client.
 *
 * **`user_name` n'existe pas dans ce que renvoie Discord** — on lisait donc une
 * clé toujours absente, et `discord_username` restait `null` pour tous les
 * comptes liés pour de vrai. Relevé sur une identité réelle, Discord fournit
 * `full_name` (le pseudo unique, « oldbroth3rz »), `custom_claims.global_name`
 * (le nom affiché) et `name` (le pseudo suivi d'un discriminant hérité, « #0 »).
 *
 * Le pseudo unique passe en premier : c'est lui qui identifie le compte sans
 * ambiguïté quand quelqu'un se demande lequel il a relié. Le nom affiché, lui,
 * peut être porté par plusieurs personnes.
 */
function nomDiscord(donnees: Record<string, unknown> | undefined): string | null {
  const claims = donnees?.custom_claims as { global_name?: string } | undefined;

  const candidat =
    (donnees?.full_name as string | undefined) ??
    (donnees?.user_name as string | undefined) ??
    claims?.global_name ??
    (donnees?.name as string | undefined);

  // « oldbroth3rz#0 » : le discriminant a disparu des comptes Discord, mais le
  // zéro traîne encore dans `name`. L'afficher ferait douter du bon compte.
  return candidat ? candidat.replace(/#0$/, '') : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const destination = new URL('/espace/communaute', url.origin);

  if (!code) {
    destination.searchParams.set(PARAM, 'discord-annule');
    return NextResponse.redirect(destination);
  }

  const supabase = await createClient();
  const { error: erreurEchange } = await supabase.auth.exchangeCodeForSession(code);

  if (erreurEchange) {
    destination.searchParams.set(PARAM, 'discord-echec');
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
    destination.searchParams.set(PARAM, 'discord-echec');
    return NextResponse.redirect(destination);
  }

  const admin = createServiceRoleClient();

  const { data: ancienLien } = await admin
    .from('discord_links')
    .select('discord_user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  // **Changer de compte Discord est une nouvelle liaison, pas un reclic.** Les
  // lignes de la file portent le `user_id` du site, jamais l'identifiant
  // Discord : un `grant` réussi pour l'ancien compte ressemble trait pour trait
  // à un rôle déjà en place. Il faut donc le savoir ici, avant d'écraser la
  // liaison — après, l'ancien identifiant n'existe plus nulle part.
  const ancienCompte =
    ancienLien && ancienLien.discord_user_id !== discordUserId ? ancienLien.discord_user_id : null;

  // `upsert` sur user_id : relier deux fois le même compte est un geste normal
  // — quelqu'un qui reclique par doute — et doit rester sans conséquence.
  // Sur un changement de compte, `roles_attribues` repart de zéro : les rôles
  // qu'elle listait sont portés par l'ancien compte, pas par le nouveau.
  const { error: erreurLien } = await admin.from('discord_links').upsert(
    {
      user_id: user.id,
      discord_user_id: discordUserId,
      discord_username: nomDiscord(identite?.identity_data),
      derniere_sync: new Date().toISOString(),
      ...(ancienCompte ? { roles_attribues: [], linked_at: new Date().toISOString() } : {}),
    },
    { onConflict: 'user_id' },
  );

  if (erreurLien) {
    destination.searchParams.set(PARAM, 'discord-echec');
    return NextResponse.redirect(destination);
  }

  if (ancienCompte) {
    // Le worker résout l'identifiant Discord au moment de traiter une ligne :
    // un `revoke` empilé maintenant viserait le nouveau compte. Retirer les
    // rôles de l'ancien est donc hors de portée de la file — sans cette trace,
    // un compte Discord garderait des accès payés que plus rien ne relie à un
    // client, et personne ne le saurait.
    await admin.from('automation_logs').insert({
      declencheur: 'discord.liaison',
      entite_type: 'discord_links',
      entite_id: user.id,
      statut: 'echec',
      details: {
        raison: 'Changement de compte Discord : retirer à la main les rôles de l’ancien compte',
        ancien_discord_user_id: ancienCompte,
        nouveau_discord_user_id: discordUserId,
      },
    });
  }

  // Le rôle `invité` : celui que tout compte reçoit à l'entrée, avant tout
  // achat. Les rôles de produit viennent ensuite, un par formation payée, et
  // par le même chemin — la file, jamais un appel direct à l'API Discord.
  const roleInvite = process.env.DISCORD_ROLE_INVITE_ID;

  if (roleInvite) {
    // Tout ce qui est dû à ce compte, pas seulement `invité` : sur un
    // changement de compte, les rôles des formations payées doivent suivre, et
    // la liaison est le seul instant où l'on sait qu'ils ne l'ont pas fait.
    // Même calcul que `etatAttendu()` dans `apps/bot/src/reconciliation.ts`.
    const { data: inscriptions } = await admin
      .from('inscriptions')
      .select('formations!inner(discord_role_id)')
      .eq('user_id', user.id)
      .eq('statut', 'active')
      .not('formations.discord_role_id', 'is', null);

    const rolesDus = new Set([roleInvite]);
    for (const inscription of inscriptions ?? []) {
      const role = (inscription.formations as { discord_role_id: string | null } | null)
        ?.discord_role_id;
      if (role) rolesDus.add(role);
    }

    // **`reussi` ne dédoublonne plus.** Un rôle accordé hier peut manquer
    // aujourd'hui — autre compte, ou membre parti puis revenu — et reconnecter
    // son Discord est justement le geste qu'on fait alors. Le worker est
    // idempotent, et chaque ligne coûte un aller-retour OAuth : la file ne
    // gonfle pas au clic. Ce qui est encore à traiter (`echoue` compris, que
    // le worker retente) suffit à ne rien empiler.
    const { data: enFile } = await admin
      .from('discord_sync_queue')
      .select('role_id')
      .eq('user_id', user.id)
      .eq('action', 'grant')
      .in('statut', ['en_attente', 'en_cours', 'echoue']);

    for (const ligne of enFile ?? []) rolesDus.delete(ligne.role_id);

    if (rolesDus.size) {
      const { error: erreurFile } = await admin
        .from('discord_sync_queue')
        .insert(
          [...rolesDus].map((role_id) => ({ user_id: user.id, action: 'grant' as const, role_id })),
        );

      // **Cette erreur était jetée**, et elle laissait passer exactement le
      // mensonge que la branche `else` ci-dessous avait été écrite pour
      // supprimer : la liaison existe, le `grant` n'a jamais été empilé, et la
      // page annonçait quand même « votre accès arrive dans la minute ». C'est ce
      // qui a convaincu que la vérification devait descendre dans les données
      // plutôt que rester dans le paramètre d'URL.
      if (erreurFile) {
        await admin.from('automation_logs').insert({
          declencheur: 'discord.liaison',
          entite_type: 'discord_links',
          entite_id: user.id,
          statut: 'echec',
          details: {
            raison: 'Mise en file des rôles Discord impossible',
            erreur: erreurFile.message,
          },
        });
      }
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

    // Rien de plus à dire ici : la page relira la file, n'y trouvera aucun
    // `grant`, et dira d'elle-même que l'accès n'a pas pu être demandé.
    // Annoncer « votre accès arrive dans la minute » après avoir enregistré un
    // échec enverrait quelqu'un attendre un rôle que personne n'a demandé — et,
    // la liaison existant désormais, il ne pourrait même pas rejouer le parcours
    // pour se rattraper.
  }

  // **Un seul code pour les deux issues**, et c'est le point du système : la
  // route n'a plus à dire si l'accès a été demandé, `/espace/communaute` le lit
  // dans la file. Deux codes pour une même vérité, c'est deux chances qu'ils se
  // contredisent — et c'est la route qui perdrait, puisqu'elle parle d'un
  // instant que la page relit une seconde plus tard.
  destination.searchParams.set(PARAM, 'discord-lie');
  return NextResponse.redirect(destination);
}
