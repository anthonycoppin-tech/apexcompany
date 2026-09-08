import Link from 'next/link';
import { notFound } from 'next/navigation';

import { EnTete } from '@/components/admin';
import { createClient } from '@/lib/supabase/server';

import { FormulaireFormation } from '../formulaire';

/**
 * `/admin/formations/[id]` — modifier un produit.
 *
 * Trois champs de cet écran décident de l'argent et des accès : le tarif, le
 * type de produit et le rôle Discord. Le reste est du contenu.
 *
 * Changer le **type de produit** d'un produit déjà vendu ne modifie rien aux
 * inscriptions existantes : leur `date_fin_acces` a été calculée à l'achat et
 * ne se recalcule pas. Le changement ne vaut donc que pour les ventes à venir —
 * ce qui est le comportement voulu, mais mérite d'être su avant de le faire.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: formation } = await supabase
    .from('formations')
    .select(
      'id, titre, slug, description, objectifs_pedagogiques, prerequis, type_produit, modalite, prix_cents, duree_acces_jours, duree_semaines, volume_horaire, discord_role_id, actif, ordre',
    )
    .eq('id', id)
    .maybeSingle();

  if (!formation) notFound();

  // Combien de personnes ont déjà acheté ce produit : c'est ce qui dit si une
  // modification est anodine ou non.
  const { data: inscriptions } = await supabase
    .from('inscriptions')
    .select('id')
    .eq('formation_id', formation.id);

  const vendues = inscriptions?.length ?? 0;

  return (
    <>
      <EnTete
        titre={formation.titre}
        description={`/formations/${formation.slug}`}
        action={
          <Link
            href={`/formations/${formation.slug}`}
            className="text-sm text-accent hover:underline"
          >
            Voir la fiche publique →
          </Link>
        }
      />

      {vendues > 0 && (
        <p className="rounded-carte border border-filet bg-fond p-4 text-sm text-encre-doux">
          {vendues} inscription{vendues > 1 ? 's' : ''} sur ce produit. Changer le tarif ou le type
          n’y touche pas : leur date de fin d’accès a été calculée à l’achat et ne se recalcule pas.
          La modification ne vaut que pour les ventes à venir.
        </p>
      )}

      <FormulaireFormation formation={formation} />

      <p className="text-sm">
        <Link href="/admin/formations" className="text-accent hover:underline">
          ← Retour au catalogue
        </Link>
      </p>
    </>
  );
}
