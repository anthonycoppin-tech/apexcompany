import { EnTete, Pastille, Tableau } from '@/components/admin';
import { requireRole } from '@/lib/auth/roles';

/**
 * `/admin/parametres` — réservé à `owner`.
 *
 * **La garde est posée ici et pas dans le layout**, qui laisse entrer `admin`.
 * Même raisonnement que `/admin/audit` : un menu qui masque un lien n'est pas
 * une protection, c'est la page qui doit refuser.
 *
 * Ce que cet écran montre aujourd'hui : **quels services sont réellement
 * branchés**. C'est la question qu'on se pose en premier quand quelque chose ne
 * marche pas — un paiement qui n'aboutit pas, un rôle Discord qui n'arrive
 * jamais — et la réponse se cherche sinon dans les variables d'environnement du
 * serveur.
 *
 * **Aucune valeur de clé n'est affichée, jamais.** On dit si elle est
 * renseignée, pas ce qu'elle contient : un secret lu à l'écran est un secret
 * qui finit dans une capture d'écran. Le contrôle se fait côté serveur, cette
 * page ne renvoie qu'un booléen au navigateur.
 */
const SERVICES: Array<{ nom: string; variables: string[]; consequence: string }> = [
  {
    nom: 'Supabase — clé serveur',
    variables: ['SUPABASE_SERVICE_ROLE_KEY'],
    consequence: 'Sans elle, le formulaire ne crée ni compte ni prospect.',
  },
  {
    nom: 'Stripe',
    variables: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    consequence: 'Sans elles, aucun paiement ne s’ouvre et aucun encaissement n’est reçu.',
  },
  {
    nom: 'Discord',
    variables: ['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID', 'DISCORD_ROLE_INVITE_ID'],
    consequence: 'Sans elles, les accès ne sont jamais attribués ni retirés.',
  },
  {
    nom: 'Cal.com',
    variables: ['NEXT_PUBLIC_CAL_LIEN', 'CAL_WEBHOOK_SECRET'],
    consequence: 'Sans elles, aucun rendez-vous n’est enregistré en base.',
  },
  {
    nom: 'Tâche de révocation',
    variables: ['CRON_SECRET'],
    consequence: 'Sans elle, la révocation quotidienne refuse d’être déclenchée.',
  },
];

export default async function Page() {
  await requireRole(['owner']);

  // Lu côté serveur, et réduit à un booléen avant d'atteindre le rendu.
  const etats = SERVICES.map((service) => ({
    ...service,
    manquantes: service.variables.filter((v) => !process.env[v]),
  }));

  const incomplets = etats.filter((e) => e.manquantes.length > 0);

  return (
    <>
      <EnTete titre="Paramètres" description="Ce qui est branché, et ce qui ne l’est pas" />

      {incomplets.length > 0 && (
        <p className="rounded-carte border border-filet bg-fond p-4 text-sm text-encre-doux">
          {incomplets.length} service{incomplets.length > 1 ? 's' : ''} incomplet
          {incomplets.length > 1 ? 's' : ''}. Tant qu’un service manque, la partie du parcours qui
          en dépend échoue en silence côté client — d’où cet écran.
        </p>
      )}

      <div className="rounded-carte border border-filet bg-fond p-5">
        <Tableau colonnes={['Service', 'État', 'Ce qui ne marche pas sans']} largeurMin="52rem">
          {etats.map((e) => (
            <tr key={e.nom} className="border-b border-filet align-top last:border-0">
              <td className="py-3 pr-4">
                <span className="font-medium">{e.nom}</span>
                <span className="block font-mono text-xs text-encre-faible">
                  {e.variables.join(' · ')}
                </span>
              </td>
              <td className="py-3 pr-4">
                {e.manquantes.length === 0 ? (
                  <Pastille ton="bon">Configuré</Pastille>
                ) : (
                  <Pastille ton="probleme">
                    {e.manquantes.length} manquante{e.manquantes.length > 1 ? 's' : ''}
                  </Pastille>
                )}
              </td>
              <td className="py-3 text-encre-doux">{e.consequence}</td>
            </tr>
          ))}
        </Tableau>
      </div>

      <p className="text-sm text-encre-doux">
        Ces valeurs se renseignent dans l’environnement du serveur, pas depuis cette page. Aucune
        n’est affichée ici : on dit qu’une clé existe, jamais ce qu’elle contient.
      </p>
    </>
  );
}
