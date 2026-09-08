import { EnTete, Pastille, Tableau, Tuile, Vide, type Ton } from '@/components/admin';
import { dateCourte } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

const ETATS: Record<string, { libelle: string; ton: Ton }> = {
  active: { libelle: 'Actif', ton: 'bon' },
  impayee: { libelle: 'Prélèvement en échec', ton: 'probleme' },
  resiliee: { libelle: 'Résilié', ton: 'attente' },
  terminee: { libelle: 'Terminé', ton: 'neutre' },
};

/**
 * `/admin/abonnements` — les revenus récurrents, et ce qui menace de s'arrêter.
 *
 * L'ordre du tableau est celui de l'urgence : les impayés d'abord, les
 * résiliations ensuite, les actifs après. Un abonnement qui va bien n'a rien à
 * dire ; c'est celui qui a raté son prélèvement qui demande un appel, et le
 * chercher dans une liste triée par date de création est du temps perdu.
 *
 * Rappel utile en lisant cet écran : **un prélèvement en échec ne coupe pas
 * l'accès**, et une résiliation non plus — elle prend effet à la fin de la
 * période déjà payée. C'est la révocation quotidienne qui referme, le lendemain
 * de la date de fin.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: abonnements } = await supabase
    .from('subscriptions')
    .select(
      'id, statut, periode_fin, resiliation_demandee_le, created_at, formations(titre), profiles!subscriptions_user_id_fkey(prenom, nom, email)',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const liste = abonnements ?? [];
  const rang: Record<string, number> = { impayee: 0, resiliee: 1, active: 2, terminee: 3 };
  const triees = [...liste].sort((a, b) => (rang[a.statut] ?? 9) - (rang[b.statut] ?? 9));

  const compte = (s: string) => liste.filter((a) => a.statut === s).length;

  return (
    <>
      <EnTete titre="Abonnements" description={`${liste.length} au total`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tuile libelle="Actifs" valeur={String(compte('active'))} ton="bon" />
        <Tuile
          libelle="Prélèvements en échec"
          valeur={String(compte('impayee'))}
          detail="accès toujours ouvert"
          ton={compte('impayee') > 0 ? 'probleme' : 'neutre'}
        />
        <Tuile
          libelle="Résiliations en cours"
          valeur={String(compte('resiliee'))}
          detail="accès jusqu’au terme payé"
          ton={compte('resiliee') > 0 ? 'attente' : 'neutre'}
        />
        <Tuile libelle="Terminés" valeur={String(compte('terminee'))} />
      </div>

      {triees.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={['Client', 'Produit', 'Statut', 'Période jusqu’au', 'Résiliation demandée']}
            largeurMin="52rem"
          >
            {triees.map((a) => {
              const etat = ETATS[a.statut];

              return (
                <tr key={a.id} className="border-b border-filet last:border-0">
                  <td className="py-2.5 pr-4">
                    {[a.profiles?.prenom, a.profiles?.nom].filter(Boolean).join(' ') || '—'}
                    <span className="block text-xs text-encre-faible">{a.profiles?.email}</span>
                  </td>
                  <td className="py-2.5 pr-4">{a.formations?.titre ?? '—'}</td>
                  <td className="py-2.5 pr-4">
                    <Pastille ton={etat?.ton ?? 'neutre'}>{etat?.libelle ?? a.statut}</Pastille>
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap text-encre-doux">
                    {dateCourte(a.periode_fin)}
                  </td>
                  <td className="py-2.5 whitespace-nowrap text-encre-doux">
                    {a.resiliation_demandee_le ? dateCourte(a.resiliation_demandee_le) : '—'}
                  </td>
                </tr>
              );
            })}
          </Tableau>
        </div>
      ) : (
        <Vide>Aucun abonnement. Ils se créent au premier paiement d’un produit récurrent.</Vide>
      )}
    </>
  );
}
