import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Carte, Conteneur } from '@/components/ui';
import { destinationApresConnexion } from '@/lib/auth/destination';
import { getUserRoles } from '@/lib/auth/roles';

import { FormulaireInscription } from './formulaire';

export const metadata = {
  title: 'Créer un compte',
  description: 'Créez votre compte et rejoignez la communauté Discord en invité.',
};

/**
 * `/inscription` — un compte sans passer par le formulaire de qualification.
 *
 * Ajoutée le 25 septembre 2026 à la demande du client : le formulaire reste la
 * porte d'entrée conseillée (il prépare l'audit), mais il ne doit plus être la
 * seule. Un compte créé ici reçoit le rôle Discord `invité` dès la liaison,
 * enchaînée automatiquement.
 *
 * Réservée aux visiteurs anonymes, comme `/qualification` : une session
 * ouverte est renvoyée vers son espace.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ src?: string }> }) {
  const roles = await getUserRoles();
  if (roles.length > 0) redirect(destinationApresConnexion(roles));

  const { src } = await searchParams;

  return (
    <Conteneur largeur="etroite" className="space-y-8 py-16 sm:py-24">
      <div className="space-y-3">
        <h1 className="text-3xl font-extrabold">Créer mon compte</h1>
        <p className="leading-relaxed text-encre-doux">
          Trente secondes, puis la connexion à Discord : vous rejoignez la communauté en invité, et
          retrouvez vos accès, vos propositions et vos factures dans votre espace.
        </p>
      </div>

      <Carte>
        <FormulaireInscription src={src} />
      </Carte>

      <p className="text-sm text-encre-doux">
        Déjà un compte ?{' '}
        <Link href="/connexion" className="text-accent hover:underline">
          Se connecter
        </Link>
        {' · '}
        Envie d’être orienté d’abord ?{' '}
        <Link href="/qualification" className="text-accent hover:underline">
          Faire le point sur ma situation
        </Link>
      </p>
    </Conteneur>
  );
}
