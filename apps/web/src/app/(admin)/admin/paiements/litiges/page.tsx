import { formaterMontant } from '@apex/db';

import { EnTete, Pastille, Tableau, Tuile, Vide, type Ton } from '@/components/admin';
import { dateCourte } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

const ETATS: Record<string, { libelle: string; ton: Ton }> = {
  ouvert: { libelle: 'Ouvert', ton: 'probleme' },
  preuves_envoyees: { libelle: 'Preuves envoyées', ton: 'attente' },
  gagne: { libelle: 'Gagné', ton: 'bon' },
  perdu: { libelle: 'Perdu', ton: 'neutre' },
  clos: { libelle: 'Clos', ton: 'neutre' },
};

/**
 * `/admin/paiements/litiges` — les contestations de paiement.
 *
 * **La date limite de réponse est la seule colonne qui compte vraiment.** Un
 * litige non contesté dans les délais est perdu d'office, sans recours et avec
 * des frais en plus. C'est pourquoi elle est mise en avant plutôt que noyée
 * dans le tableau, et pourquoi les litiges dont l'échéance approche remontent
 * en tête.
 *
 * Rappel du modèle de données : le client ne voit jamais cet écran ni son
 * contenu. Un litige est une affaire entre la société et le prestataire, et
 * `disputes` n'a volontairement aucune politique de lecture côté client.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: litiges } = await supabase
    .from('disputes')
    .select(
      'id, montant_cents, statut, deadline_reponse, provider_dispute_id, created_at, payments(devise, provider, provider_payment_id, orders(profiles(prenom, nom, email)))',
    )
    .order('deadline_reponse', { ascending: true, nullsFirst: false })
    .limit(200);

  const liste = litiges ?? [];
  const ouverts = liste.filter((d) => d.statut === 'ouvert' || d.statut === 'preuves_envoyees');
  const enjeu = ouverts.reduce((t, d) => t + d.montant_cents, 0);

  const dansMoinsDe = (date: string | null, jours: number) => {
    if (!date) return false;
    const limite = new Date();
    limite.setDate(limite.getDate() + jours);
    return new Date(date) <= limite;
  };

  const urgents = ouverts.filter((d) => dansMoinsDe(d.deadline_reponse, 3));

  return (
    <>
      <EnTete titre="Litiges" description={`${liste.length} contestations`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tuile
          libelle="En cours"
          valeur={String(ouverts.length)}
          ton={ouverts.length > 0 ? 'probleme' : 'bon'}
        />
        <Tuile
          libelle="À répondre sous 3 jours"
          valeur={String(urgents.length)}
          detail="passé le délai, le litige est perdu d’office"
          ton={urgents.length > 0 ? 'probleme' : 'bon'}
        />
        <Tuile libelle="Montant en jeu" valeur={formaterMontant(enjeu)} />
      </div>

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={['Répondre avant', 'Client', 'Montant', 'Statut', 'Référence', 'Ouvert le']}
            largeurMin="62rem"
          >
            {liste.map((d) => {
              const etat = ETATS[d.statut];
              const presse =
                (d.statut === 'ouvert' || d.statut === 'preuves_envoyees') &&
                dansMoinsDe(d.deadline_reponse, 3);

              return (
                <tr key={d.id} className="border-b border-filet last:border-0">
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    <span className={presse ? 'font-semibold text-alerte' : 'text-encre-doux'}>
                      {dateCourte(d.deadline_reponse)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    {[d.payments?.orders?.profiles?.prenom, d.payments?.orders?.profiles?.nom]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    {formaterMontant(d.montant_cents, d.payments?.devise ?? 'EUR')}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Pastille ton={etat?.ton ?? 'neutre'}>{etat?.libelle ?? d.statut}</Pastille>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-encre-faible">
                    {d.provider_dispute_id ?? '—'}
                  </td>
                  <td className="py-2.5 whitespace-nowrap text-encre-doux">
                    {dateCourte(d.created_at)}
                  </td>
                </tr>
              );
            })}
          </Tableau>
        </div>
      ) : (
        <Vide>
          Aucun litige. Ils remontent par le webhook du prestataire quand un client conteste un
          paiement auprès de sa banque.
        </Vide>
      )}
    </>
  );
}
