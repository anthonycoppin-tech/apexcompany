import Link from 'next/link';

import { formaterMontant } from '@apex/db';

import { Pastille, type Ton } from '@/components/admin';
import { Carte, LISTE } from '@/components/ui';
import { dateCourte } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

/**
 * `/espace/propositions` — tout ce que le formateur a proposé, ouvert ou non.
 *
 * Né de la présentation au client du 25 septembre 2026 : la proposition
 * n'était visible que sous forme d'encart sur `/espace`, et on ne l'a pas
 * trouvée. Elle a maintenant sa place dans le menu, et l'historique avec elle —
 * une proposition expirée qu'on cherche et qu'on ne trouve pas est aussi
 * déroutante qu'une ouverte.
 *
 * La RLS (`propositions_client_lit_les_siennes`) ne rend que les siennes.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('propositions')
    .select('id, statut, montant_cents, devise, expire_le, created_at, formations(titre)')
    .order('created_at', { ascending: false });

  const maintenant = new Date().getTime();
  const propositions = (data ?? []).map((p) => {
    // Le statut en base ne passe pas tout seul à « expirée » à l'échéance :
    // c'est la date qui fait foi, pas la colonne.
    const perimee =
      p.statut === 'expiree' ||
      (p.statut === 'envoyee' && !!p.expire_le && new Date(p.expire_le).getTime() < maintenant);
    const ouverte = p.statut === 'envoyee' && !perimee;
    const [libelle, ton]: [string, Ton] = ouverte
      ? ['À régler', 'attente']
      : p.statut === 'acceptee'
        ? ['Réglée', 'bon']
        : p.statut === 'refusee'
          ? ['Déclinée', 'neutre']
          : ['Expirée', 'neutre'];
    return { ...p, ouverte, libelle, ton };
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold">Mes propositions</h1>
        <p className="text-encre-doux">
          Ce que votre formateur vous a proposé. Une proposition se règle depuis sa page, tant
          qu’elle est valable.
        </p>
      </div>

      {propositions.length ? (
        <ul className={LISTE}>
          {propositions.map((p) => (
            <li key={p.id}>
              <Link
                href={`/espace/propositions/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-surface"
              >
                <span className="min-w-0 space-y-0.5">
                  <span className="block font-medium">{p.formations?.titre ?? 'Programme'}</span>
                  <span className="block text-sm text-encre-doux">
                    Proposée le {dateCourte(p.created_at)}
                    {p.ouverte && p.expire_le
                      ? ` · valable jusqu’au ${dateCourte(p.expire_le)}`
                      : ''}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">
                    {formaterMontant(p.montant_cents, p.devise)}
                  </span>
                  <Pastille ton={p.ton}>{p.libelle}</Pastille>
                  {p.ouverte && <span className="text-sm font-semibold text-accent">Régler →</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Carte>
          <p className="leading-relaxed text-encre-doux">
            Aucune proposition pour l’instant. Elle apparaît ici dès que votre formateur vous en
            adresse une — ou{' '}
            <Link href="/formations" className="font-semibold text-accent hover:underline">
              choisissez directement un programme
            </Link>
            .
          </p>
        </Carte>
      )}
    </div>
  );
}
