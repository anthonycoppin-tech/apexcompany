import Link from 'next/link';

import { EnTete } from '@/components/admin';

import { FormulaireFormation } from '../formulaire';

/**
 * `/admin/formations/nouveau` — créer un produit.
 *
 * Même formulaire que l'édition, sans produit à charger. Un nouveau produit
 * arrive en brouillon par défaut : on le prépare, on crée son rôle Discord,
 * puis on le publie. Publier d'abord et compléter ensuite, c'est laisser une
 * fenêtre pendant laquelle il est achetable sans ouvrir d'accès.
 */
export default function Page() {
  return (
    <>
      <EnTete
        titre="Nouveau produit"
        description="Il arrive en brouillon : rien n’est visible tant qu’il n’est pas publié."
      />

      <FormulaireFormation />

      <p className="text-sm">
        <Link href="/admin/formations" className="text-accent hover:underline">
          ← Retour au catalogue
        </Link>
      </p>
    </>
  );
}
