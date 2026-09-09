import Link from 'next/link';

import { Bouton, Carte, Conteneur, Section, Surtitre } from '@/components/ui';

export const metadata = {
  title: 'Contact',
  description: 'Comment nous joindre, et par quel chemin selon votre situation.',
};

// À CONFIRMER avec le client avant mise en ligne : adresse retenue pour le
// support, et adresse dédiée aux demandes RGPD (elle doit figurer dans la
// politique de confidentialité).
const EMAIL_SUPPORT = 'contact@apexcompany.com';

/**
 * `/contact` — volontairement sans formulaire.
 *
 * Un formulaire de contact ici ferait un second tunnel à côté du premier :
 * des demandes qui arrivent dans une boîte mail au lieu du CRM, sans fiche,
 * sans suivi, et sans que personne sache si elles ont été traitées. C'est
 * exactement la redondance que la révision 3 a supprimée.
 *
 * Chaque situation est donc orientée vers le bon chemin : le tunnel pour qui
 * veut se former, l'espace client pour qui l'est déjà, l'email pour le reste.
 */
export default function Page() {
  return (
    <>
      <section className="border-b border-filet bg-surface">
        <Conteneur largeur="moyenne" className="space-y-5 py-16 sm:py-24">
          <Surtitre>Contact</Surtitre>
          <h1 className="text-4xl font-extrabold sm:text-5xl">Par où passer</h1>
          <p className="text-lg leading-relaxed text-encre-doux">
            Selon votre situation, le chemin le plus rapide n’est pas le même.
          </p>
        </Conteneur>
      </section>

      <Section>
        <div className="grid gap-6 md:grid-cols-3">
          <Carte className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Vous voulez vous former</h2>
            <p className="flex-1 leading-relaxed text-encre-doux">
              Deux minutes de questions, puis un échange d’orientation de trente minutes, offert.
              C’est plus rapide et plus utile qu’un email.
            </p>
            <Bouton href="/qualification">Faire le point</Bouton>
          </Carte>

          <Carte className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Vous êtes déjà accompagné</h2>
            <p className="flex-1 leading-relaxed text-encre-doux">
              Vos accès, vos factures et votre abonnement se gèrent depuis votre espace. Pour le
              reste, votre formateur est joignable sur Discord.
            </p>
            <Bouton href="/espace" variante="secondaire">
              Ouvrir mon espace
            </Bouton>
          </Carte>

          <Carte className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Autre demande</h2>
            <p className="flex-1 leading-relaxed text-encre-doux">
              Presse, partenariat, facturation, exercice de vos droits sur vos données : écrivez-
              nous, nous répondons sous 24 heures ouvrées.
            </p>
            <a
              href={`mailto:${EMAIL_SUPPORT}`}
              className="font-semibold text-accent hover:underline"
            >
              {EMAIL_SUPPORT}
            </a>
          </Carte>
        </div>

        <p className="mt-10 text-sm text-encre-doux">
          Pour toute question sur vos données personnelles, voir aussi notre{' '}
          <Link href="/confidentialite" className="text-accent hover:underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
