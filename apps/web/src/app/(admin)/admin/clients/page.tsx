import Link from 'next/link';

import { formaterMontant } from '@apex/db';

import { EnTete, Pastille, Tableau, Tuile, Vide } from '@/components/admin';
import { dateCourte } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

/**
 * `/admin/clients` — les personnes qui ont acheté.
 *
 * La distinction avec `/admin/crm/leads` n'est pas cosmétique : un prospect est
 * quelqu'un qu'on suit, un client est quelqu'un dont on doit tenir les accès et
 * la facturation. Les deux écrans ne répondent pas aux mêmes questions, et
 * mélanger 500 fiches de prospects avec 30 clients rend les deux illisibles.
 *
 * Un compte sans inscription n'apparaît donc pas ici — il est dans les
 * prospects, avec le reste du tunnel.
 *
 * Le tri met en tête ceux dont l'accès se termine bientôt : c'est là qu'il y a
 * quelque chose à faire, renouvellement ou relance.
 */
export default async function Page() {
  const supabase = await createClient();

  const [{ data: inscriptions }, { data: commandes }] = await Promise.all([
    supabase
      .from('inscriptions')
      // Hint explicite : `inscriptions` a deux clés vers `profiles` — le client
      // (`user_id`) et le formateur affecté (`formateur_id`). Sans préciser
      // laquelle suivre, l'embed est ambigu.
      .select(
        'id, user_id, statut, date_fin_acces, formations(titre), profiles!inscriptions_user_id_fkey(id, prenom, nom, email, created_at)',
      ),
    supabase.from('orders').select('user_id, montant_cents, statut'),
  ]);

  // Une ligne par personne, pas par inscription : quelqu'un qui cumule un
  // abonnement et un accompagnement est un seul client.
  const parClient = new Map<
    string,
    {
      profil: { id: string; prenom: string | null; nom: string | null; email: string };
      acces: Array<{ titre: string; statut: string; fin: string | null }>;
    }
  >();

  for (const i of inscriptions ?? []) {
    if (!i.profiles) continue;

    const existant = parClient.get(i.profiles.id) ?? { profil: i.profiles, acces: [] };
    existant.acces.push({
      titre: i.formations?.titre ?? 'Produit',
      statut: i.statut,
      fin: i.date_fin_acces,
    });
    parClient.set(i.profiles.id, existant);
  }

  const encaisseDe = (userId: string) =>
    (commandes ?? [])
      .filter((c) => c.user_id === userId && c.statut === 'payee')
      .reduce((total, c) => total + c.montant_cents, 0);

  // La première échéance qui arrive, `null` (illimité) en dernier.
  const prochaineFin = (acces: Array<{ fin: string | null; statut: string }>) => {
    const dates = acces
      .filter((a) => a.statut === 'active' && a.fin)
      .map((a) => a.fin as string)
      .sort();
    return dates[0] ?? null;
  };

  const liste = [...parClient.values()].sort((a, b) => {
    const fa = prochaineFin(a.acces);
    const fb = prochaineFin(b.acces);
    if (fa && fb) return fa.localeCompare(fb);
    if (fa) return -1;
    if (fb) return 1;
    return 0;
  });

  const actifs = liste.filter((c) => c.acces.some((a) => a.statut === 'active')).length;

  return (
    <>
      <EnTete titre="Clients" description={`${liste.length} personnes ayant acheté`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tuile libelle="Clients" valeur={String(liste.length)} />
        <Tuile libelle="Avec un accès ouvert" valeur={String(actifs)} ton="bon" />
        <Tuile
          libelle="Encaissé total"
          valeur={formaterMontant(
            (commandes ?? [])
              .filter((c) => c.statut === 'payee')
              .reduce((t, c) => t + c.montant_cents, 0),
          )}
        />
      </div>

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={['Personne', 'Accès', 'Prochaine échéance', 'Encaissé']}
            largeurMin="52rem"
          >
            {liste.map(({ profil, acces }) => {
              const fin = prochaineFin(acces);

              return (
                <tr key={profil.id} className="border-b border-filet align-top last:border-0">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/clients/${profil.id}`}
                      className="font-medium hover:underline"
                    >
                      {[profil.prenom, profil.nom].filter(Boolean).join(' ') || 'Sans nom'}
                    </Link>
                    <span className="block text-xs text-encre-faible">{profil.email}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1.5">
                      {acces.map((a, index) => (
                        <Pastille key={index} ton={a.statut === 'active' ? 'bon' : 'neutre'}>
                          {a.titre}
                        </Pastille>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-encre-doux">
                    {/* Pas d'échéance = accès illimité, jamais « inconnue ». */}
                    {fin ? dateCourte(fin) : 'illimité'}
                  </td>
                  <td className="py-3 tabular-nums">{formaterMontant(encaisseDe(profil.id))}</td>
                </tr>
              );
            })}
          </Tableau>
        </div>
      ) : (
        <Vide>Aucun client. Une fiche apparaît ici au premier paiement encaissé.</Vide>
      )}
    </>
  );
}
