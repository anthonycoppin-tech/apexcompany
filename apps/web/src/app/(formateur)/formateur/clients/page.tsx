import Link from 'next/link';

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
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Mes clients</h1>
        <p className="text-sm text-neutral-500">
          Aucune personne ne vous est affectée pour l’instant.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Mes clients</h1>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="py-2 pr-4 font-medium">Personne</th>
              <th className="py-2 pr-4 font-medium">Statut</th>
              <th className="py-2 pr-4 font-medium">Budget déclaré</th>
              <th className="py-2 pr-4 font-medium">Blocage</th>
              <th className="py-2 pr-4 font-medium">Niveau</th>
              <th className="py-2 font-medium">Arrivé le</th>
            </tr>
          </thead>
          <tbody>
            {prospects.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="py-2 pr-4">
                  <Link href={`/formateur/clients/${p.id}`} className="underline">
                    {[p.prenom, p.nom].filter(Boolean).join(' ') || 'Sans nom'}
                  </Link>
                </td>
                <td className="py-2 pr-4">{ETIQUETTES[p.statut] ?? p.statut}</td>
                <td className="py-2 pr-4">{libelle('tranche_budget', p.tranche_budget)}</td>
                <td className="py-2 pr-4">{libelle('blocage', p.blocage)}</td>
                <td className="py-2 pr-4">{libelle('niveau_trading', p.niveau_trading)}</td>
                <td className="py-2 text-neutral-500">{dateCourte(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
