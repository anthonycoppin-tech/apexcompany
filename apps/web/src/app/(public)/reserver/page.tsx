import { BoutonLierDiscord } from '@/components/bouton-lier-discord';
import { MessageURL } from '@/components/message-url';
import { Carte, Conteneur } from '@/components/ui';
import { PARAM, messageCompte } from '@/lib/messages/catalogue';
import { lireEtatCompte } from '@/lib/messages/preuves';
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
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [parametres, supabase, preuve] = await Promise.all([
    searchParams,
    createClient(),
    lireEtatCompte(),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const lienCal = process.env.NEXT_PUBLIC_CAL_LIEN;

  return (
    <Conteneur largeur="moyenne" className="space-y-10 py-16 sm:py-24">
      <div className="space-y-3">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Réservez votre audit stratégique</h1>
        <p className="text-lg leading-relaxed text-encre-doux">
          Un point sur votre situation, pas une présentation de produit. Choisissez le créneau qui
          vous convient.
        </p>
      </div>

      {/* L'orphelin du tunnel : `/qualification` redirigeait ici avec un
          `?inscription=ok` que cette page n'a jamais lu. Le seul retour qui
          dit « ton compte est créé » tombait dans le vide depuis le début. */}
      <MessageURL message={messageCompte(parametres[PARAM], preuve)} />

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
          <h2 className="text-xl font-bold">Rejoignez la communauté</h2>
          <p className="leading-relaxed text-encre-doux">
            Connectez votre compte Discord pour recevoir votre accès invité. C’est là que tout se
            passe : les échanges, les lives et les replays.
          </p>
          <BoutonLierDiscord />
        </section>
      )}
    </Conteneur>
  );
}
