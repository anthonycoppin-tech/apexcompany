import Link from 'next/link';

import { Carte } from '@/components/ui';
import { dateCourte } from '@/lib/format';
import { libelle } from '@/lib/qualification/questionnaire';
import { createClient } from '@/lib/supabase/server';

const ETIQUETTES: Record<string, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  rdv: 'Rendez-vous pris',
  proposition: 'Proposition envoyée',
  gagne: 'Client',
  perdu: 'Perdu',
};

/**
 * `/formateur/clients` — ses prospects et ses clients, dans une seule liste.
 *
 * Les séparer en deux écrans supposerait que le passage de l'un à l'autre est
 * un événement ; c'est un statut qui bouge, sur la même personne et la même
 * fiche. Le tri par budget déclaré n'est pas un tri commercial déguisé : c'est
 * la donnée qui dit quel produit peut être proposé.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: prospects } = await supabase
    .from('leads')
    .select('id, prenom, nom, statut, tranche_budget, blocage, niveau_trading, created_at')
    .order('created_at', { ascending: false });

  if (!prospects?.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-extrabold">Mes clients</h1>
        <Carte>
          <p className="text-encre-doux">Aucune personne ne vous est affectée pour l’instant.</p>
        </Carte>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Mes clients</h1>

      <div className="overflow-x-auto rounded-carte border border-filet bg-fond">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-filet text-left text-encre-doux">
              <th className="px-4 py-3 font-medium">Personne</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Budget déclaré</th>
              <th className="px-4 py-3 font-medium">Blocage</th>
              <th className="px-4 py-3 font-medium">Niveau</th>
              <th className="px-4 py-3 font-medium">Arrivé le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-filet">
            {prospects.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/formateur/clients/${p.id}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {[p.prenom, p.nom].filter(Boolean).join(' ') || 'Sans nom'}
                  </Link>
                </td>
                <td className="px-4 py-3">{ETIQUETTES[p.statut] ?? p.statut}</td>
                <td className="px-4 py-3">{libelle('tranche_budget', p.tranche_budget)}</td>
                <td className="px-4 py-3">{libelle('blocage', p.blocage)}</td>
                <td className="px-4 py-3">{libelle('niveau_trading', p.niveau_trading)}</td>
                <td className="px-4 py-3 text-encre-doux">{dateCourte(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
