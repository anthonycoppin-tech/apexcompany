import { BoutonLierDiscord } from '@/components/bouton-lier-discord';
import { Carte, Conteneur } from '@/components/ui';
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
    <Conteneur largeur="moyenne" className="space-y-10 py-16 sm:py-24">
      <div className="space-y-3">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Réserve ton audit stratégique</h1>
        <p className="text-lg leading-relaxed text-encre-doux">
          Un point sur ta situation, pas une présentation de produit. Choisis le créneau qui
          t’arrange.
        </p>
      </div>

      {lienCal ? (
        <iframe
          src={lienCal}
          title="Réservation de l’audit stratégique"
          className="h-[640px] w-full rounded-carte border border-filet"
        />
      ) : (
        <Carte className="space-y-2 border-dashed">
          <p className="font-semibold">Le calendrier s’affichera ici</p>
          <p className="text-sm leading-relaxed text-encre-doux">
            Renseigner <code className="text-encre">NEXT_PUBLIC_CAL_LIEN</code> avec la page Cal.com
            de Franck. Sans elle, le tunnel s’arrête à cet écran : c’est la seule étape qui produit
            du chiffre d’affaires.
          </p>
        </Carte>
      )}

      {user && (
        <section className="space-y-3 border-t border-filet pt-8">
          <h2 className="text-xl font-bold">Rejoins la communauté</h2>
          <p className="leading-relaxed text-encre-doux">
            Connecte ton compte Discord pour recevoir ton accès invité. C’est là que tout se passe :
            les échanges, les lives et les replays.
          </p>
          <BoutonLierDiscord />
        </section>
      )}
    </Conteneur>
  );
}
