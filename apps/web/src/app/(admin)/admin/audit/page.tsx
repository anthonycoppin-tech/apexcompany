import { EnTete, Tableau, Vide } from '@/components/admin';
import { requireRole } from '@/lib/auth/roles';
import { dateHeure } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

/**
 * `/admin/audit` — les actions sensibles, réservées à `owner`.
 *
 * **La garde est posée ici et pas dans le layout**, qui laisse entrer `admin`
 * et `owner`. Un menu qui masque un lien n'est pas une protection : c'est la
 * page qui doit refuser.
 *
 * Et derrière elle, la RLS refuse aussi — `audit_logs_owner_lit` n'ouvre la
 * table qu'à un owner. Un admin qui forcerait l'URL verrait donc, au pire, une
 * page vide ; il ne verrait jamais une ligne. Cette double barrière n'est pas
 * une ceinture et des bretelles : la garde donne un message clair, la politique
 * donne la garantie.
 *
 * Pourquoi un admin n'y accède pas, alors qu'il a tous les autres pouvoirs :
 * un administrateur qui peut relire — et à plus forte raison effacer — la trace
 * de ses propres actions vide l'audit de son sens.
 */
export default async function Page() {
  await requireRole(['owner']);

  const supabase = await createClient();

  const { data: lignes } = await supabase
    .from('audit_logs')
    .select('id, action, table_cible, enregistrement_id, user_id, ip, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const liste = lignes ?? [];

  return (
    <>
      <EnTete
        titre="Journal d’audit"
        description="Actions sensibles : rôles, remboursements, catalogue"
      />

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={['Quand', 'Action', 'Table', 'Enregistrement', 'Auteur', 'IP']}
            largeurMin="58rem"
          >
            {liste.map((l) => (
              <tr key={l.id} className="border-b border-filet last:border-0">
                <td className="py-2.5 pr-4 whitespace-nowrap text-encre-doux">
                  {dateHeure(l.created_at)}
                </td>
                <td className="py-2.5 pr-4 font-medium">{l.action}</td>
                <td className="py-2.5 pr-4">{l.table_cible}</td>
                <td className="py-2.5 pr-4 font-mono text-xs text-encre-faible">
                  {l.enregistrement_id ?? '—'}
                </td>
                <td className="py-2.5 pr-4 font-mono text-xs text-encre-faible">
                  {/* `null` ici veut dire « pas d'utilisateur porteur de la
                      session » : une écriture faite par un handler en clé de
                      service, ou par une migration. */}
                  {l.user_id ?? 'système'}
                </td>
                {/* `ip` est un `inet` côté Postgres, que les types générés
                    rendent comme `unknown` : la conversion est explicite plutôt
                    que masquée par un cast. */}
                <td className="py-2.5 text-encre-doux">{l.ip ? String(l.ip) : '—'}</td>
              </tr>
            ))}
          </Tableau>
        </div>
      ) : (
        <Vide>Aucune action sensible enregistrée.</Vide>
      )}
    </>
  );
}
