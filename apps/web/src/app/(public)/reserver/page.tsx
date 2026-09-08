import { BoutonLierDiscord } from '@/components/bouton-lier-discord';
import { createClient } from '@/lib/supabase/server';

/**
 * `/reserver` — le créneau de l'audit stratégique.
 *
 * **Une seule page de réservation, celle de Franck.** C'est lui qui prend tous
 * les rendez-vous et qui attribue ensuite la formation au compte du client :
 * le prospect ne choisit donc pas son interlocuteur, et il n'y a aucun écran
 * d'aiguillage entre formateurs. Un seul utilisateur Cal.com, un seul type
 * d'événement — le plan gratuit suffit.
 *
 * **Cal.com ne sert qu'ici, une fois.** Les séances qui suivent l'achat
 * s'organisent hors plateforme (01-CAHIER-DES-CHARGES.md §3, étape 4 bis).
 *
 * La liaison Discord est proposée APRÈS le créneau, jamais avant : rien ne doit
 * s'interposer entre le formulaire et la prise de rendez-vous, qui est la seule
 * étape du tunnel produisant du chiffre d'affaires.
 */
export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const lienCal = process.env.NEXT_PUBLIC_CAL_LIEN;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Réserve ton audit stratégique</h1>
        <p className="text-sm text-neutral-600">
          Un point sur ta situation, pas une présentation de produit. Choisis le créneau qui
          t’arrange.
        </p>
      </div>

      {lienCal ? (
        <iframe
          src={lienCal}
          title="Réservation de l’audit stratégique"
          className="h-[640px] w-full rounded border"
        />
      ) : (
        <p className="rounded border border-dashed p-4 text-sm text-neutral-500">
          Placeholder — le calendrier s’affichera ici. Renseigner <code>NEXT_PUBLIC_CAL_LIEN</code>{' '}
          avec la page Cal.com de Franck. La route <code>api/cal</code> reste à écrire : sans son
          webhook, aucune ligne <code>appointments</code> n’est créée, donc pas de tableau de bord
          formateur ni de statistique de no-show.
        </p>
      )}

      {user && (
        <section className="space-y-2 border-t pt-6">
          <h2 className="text-lg font-semibold">Rejoins la communauté</h2>
          <p className="text-sm text-neutral-600">
            Connecte ton compte Discord pour recevoir ton accès invité. C’est là que tout se passe :
            les échanges, les lives et les replays.
          </p>
          <BoutonLierDiscord />
        </section>
      )}
    </div>
  );
}
