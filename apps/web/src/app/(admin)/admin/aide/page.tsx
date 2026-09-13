import Link from 'next/link';

import { EnTete, Pastille, Vide } from '@/components/admin';
import { dateHeure } from '@/lib/format';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export const metadata = { title: 'Aide' };

/**
 * `/admin/aide` — les runbooks d'exploitation, indexés par **symptôme**.
 *
 * « J'ai payé et je n'ai pas accès », pas « réconciliation des rôles Discord ».
 * Personne n'arrive ici en connaissant le nom du mécanisme : on y arrive avec
 * la phrase d'un client.
 *
 * **Ce qui peut être mesuré n'est jamais affirmé.** Une page d'aide qui écrit
 * « la réconciliation tourne tous les jours » se périme le jour où elle cesse
 * de tourner, sans que personne ne le voie — et devient alors pire qu'absente,
 * puisqu'on s'y fie. Tout ce qui est ci-dessous en encadré est lu en base à
 * l'affichage. Le texte statique se limite à la procédure, qui ne bouge pas.
 *
 * C'est le même garde-fou que « pas de chiffre sans source ni date » sur
 * l'accueil, et que `/admin/parametres` qui montre ce qui est réellement
 * branché plutôt que de l'annoncer.
 *
 * **Une entrée ne naît que d'un incident réellement survenu.** Anticiper les
 * pannes produit des pages que personne ne relit et que rien ne vérifie.
 */
export default async function Page() {
  const admin = createServiceRoleClient();

  const [reconciliation, revocation, file, sansLien] = await Promise.all([
    admin
      .from('automation_logs')
      .select('created_at, details')
      .eq('declencheur', 'discord.reconciliation')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('automation_logs')
      .select('created_at, details')
      .eq('declencheur', 'revocation.quotidienne')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from('discord_sync_queue').select('statut'),
    // Des accès actifs dont le titulaire n'a jamais lié son Discord : la cause
    // la plus fréquente, et la seule que l'équipe ne peut pas régler seule.
    admin.from('inscriptions').select('user_id').eq('statut', 'active'),
  ]);

  const parStatut = new Map<string, number>();
  for (const ligne of file.data ?? []) {
    parStatut.set(ligne.statut, (parStatut.get(ligne.statut) ?? 0) + 1);
  }

  const abandonnees = parStatut.get('abandonne') ?? 0;
  const enEchec = parStatut.get('echoue') ?? 0;
  const enAttente = parStatut.get('en_attente') ?? 0;

  const { data: liens } = await admin.from('discord_links').select('user_id');
  const lies = new Set((liens ?? []).map((l) => l.user_id));
  const actifsSansDiscord = new Set(
    (sansLien.data ?? []).map((i) => i.user_id).filter((u) => !lies.has(u)),
  ).size;

  return (
    <div className="space-y-10">
      <EnTete
        titre="Aide"
        description="Ce qu'on fait quand quelque chose ne marche pas, rangé par ce que dit le client."
      />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">« J’ai payé et je n’ai pas accès »</h2>
          <p className="mt-1 text-sm text-encre-doux">
            Le client voit son accès dans son espace, mais rien n’apparaît sur Discord.
          </p>
        </div>

        {/* ── L'état, lu maintenant ─────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2">
          <EtatCarte
            titre="Dernière réconciliation"
            valeur={reconciliation.data ? dateHeure(reconciliation.data.created_at) : 'jamais'}
            ton={reconciliation.data ? 'bon' : 'probleme'}
            detail={
              reconciliation.data
                ? `${(reconciliation.data.details as { roles_reempiles?: number } | null)?.roles_reempiles ?? 0} rôle(s) rattrapé(s)`
                : 'Rien ne l’a encore lancée. Aucun rôle manquant n’est rattrapé automatiquement.'
            }
          />
          <EtatCarte
            titre="Dernière révocation"
            valeur={revocation.data ? dateHeure(revocation.data.created_at) : 'jamais'}
            ton={revocation.data ? 'bon' : 'attente'}
            detail={
              revocation.data
                ? `${(revocation.data.details as { roles_revoques?: number } | null)?.roles_revoques ?? 0} rôle(s) retiré(s)`
                : 'Les accès expirés ne sont pas retirés tant qu’elle ne tourne pas.'
            }
          />
          <EtatCarte
            titre="File de synchronisation"
            valeur={`${enAttente} en attente`}
            ton={abandonnees || enEchec ? 'probleme' : 'bon'}
            detail={
              abandonnees || enEchec
                ? `${enEchec} en échec, ${abandonnees} abandonnée(s) — autant d’accès jamais ouverts.`
                : 'Rien en échec.'
            }
          />
          <EtatCarte
            titre="Accès actifs sans Discord lié"
            valeur={`${actifsSansDiscord}`}
            ton={actifsSansDiscord ? 'attente' : 'bon'}
            detail={
              actifsSansDiscord
                ? 'Ces clients doivent connecter leur compte eux-mêmes depuis leur espace. Personne ne peut le faire à leur place.'
                : 'Tous les accès actifs ont un compte Discord lié.'
            }
          />
        </div>

        {/* ── La procédure ──────────────────────────────────────────── */}
        <ol className="space-y-3">
          <Etape rang="1" titre="Le client a-t-il lié son compte Discord ?">
            C’est la cause la plus fréquente, et la seule que l’équipe ne peut pas régler à sa
            place. Sa fiche le dit en tête —{' '}
            <Lien href="/admin/clients">ouvrir la liste des clients</Lien>. Si la liaison manque, il
            doit la faire depuis <code>/espace/communaute</code>.
          </Etape>

          <Etape rang="2" titre="Est-il bien membre du serveur Discord ?">
            Un compte lié ne veut pas dire présent sur le serveur. Le worker ne peut accorder un
            rôle qu’à quelqu’un qui a rejoint — sinon la ligne part en <code>abandonne</code>{' '}
            immédiatement, sans réessai.
          </Etape>

          <Etape rang="3" titre="Le produit acheté a-t-il un rôle Discord ?">
            Sans rôle sur la fiche produit, un paiement n’ouvre aucun accès.{' '}
            <Lien href="/admin/formations">vérifier le catalogue</Lien>. Un produit publié ne peut
            plus être enregistré sans rôle, mais les anciens peuvent en manquer.
          </Etape>

          <Etape rang="4" titre="Réattribuer, depuis sa fiche">
            Le bouton <strong>« Réattribuer les accès Discord »</strong> sur la fiche du client
            remet en file tout ce qui lui est dû. C’est sans risque : réaccorder un rôle déjà porté
            ne fait rien.
          </Etape>

          <Etape rang="5" titre="Si rien n’arrive, le worker ne tourne pas">
            Les lignes restent <code>en attente</code> avec zéro tentative — c’est le signe.{' '}
            <Lien href="/admin/logs">voir les automatisations</Lien>. Le worker est un programme à
            part, qui doit tourner en permanence.
          </Etape>
        </ol>

        <p className="rounded-carte border border-filet bg-surface p-4 text-sm text-encre-doux">
          <strong className="text-encre">Pour un rattrapage général</strong>, et non pour un seul
          client : <code>npm run discord:reconcile</code> compare l’état réel de Discord à ce que la
          base dit dû, et réempile tout ce qui manque. Sans danger — elle accorde seulement, ne
          retire jamais, et ne touche qu’aux rôles du site.
        </p>
      </section>

      <section className="space-y-3 border-t border-filet pt-8">
        <h2 className="text-sm font-semibold text-encre-doux">Les autres symptômes</h2>
        <Vide>
          Une entrée s’ajoute ici quand un incident est réellement survenu, pas avant. Écrire des
          procédures pour des pannes imaginées produit des pages que personne ne relit et que rien
          ne vérifie.
        </Vide>
      </section>
    </div>
  );
}

function EtatCarte({
  titre,
  valeur,
  detail,
  ton,
}: {
  titre: string;
  valeur: string;
  detail: string;
  ton: 'bon' | 'attente' | 'probleme';
}) {
  return (
    <div className="rounded-carte border border-filet bg-fond p-4">
      <p className="text-xs font-semibold tracking-wide text-encre-faible uppercase">{titre}</p>
      <div className="mt-2 flex items-center gap-2">
        <Pastille ton={ton}>{valeur}</Pastille>
      </div>
      <p className="mt-2 text-sm text-encre-doux">{detail}</p>
    </div>
  );
}

function Etape({
  rang,
  titre,
  children,
}: {
  rang: string;
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-3 rounded-carte border border-filet bg-fond p-4">
      <span className="font-mono text-sm text-encre-faible">{rang}</span>
      <div>
        <p className="font-semibold">{titre}</p>
        <p className="mt-1 text-sm leading-relaxed text-encre-doux">{children}</p>
      </div>
    </li>
  );
}

function Lien({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-accent underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}
