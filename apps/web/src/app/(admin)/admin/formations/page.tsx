import Link from 'next/link';

import { formaterMontant } from '@apex/db';

import { EnTete, Pastille, Tableau, Vide } from '@/components/admin';
import { createClient } from '@/lib/supabase/server';

const TYPES: Record<string, string> = {
  abonnement: 'Abonnement mensuel',
  accompagnement: 'Accompagnement',
  formation: 'Formation',
};

/**
 * `/admin/formations` — le catalogue.
 *
 * L'édition a son propre écran (`/admin/formations/[id]`) plutôt que des champs
 * ajoutés au bas de ce tableau : elle touche au prix, au type et au rôle
 * Discord, c'est-à-dire à ce qui décide de l'argent et des accès.
 *
 * Deux colonnes valent qu'on s'y arrête, parce qu'elles cassent des choses en
 * silence quand elles sont fausses :
 *
 * **Le rôle Discord.** Un produit sans rôle se vend, s'encaisse et ouvre une
 * inscription — mais n'ouvre aucun accès. Le paiement laisse alors une trace
 * d'échec dans les automatisations, et le client attend sans rien voir venir.
 *
 * **La durée d'accès.** Elle n'a de sens que pour un accompagnement ; une
 * formation à durée non nulle serait un accès à vie qui se referme. La base
 * l'interdit par contrainte, mais le voir ici évite de la chercher.
 */
export default async function Page() {
  const supabase = await createClient();

  const { data: formations } = await supabase
    .from('formations')
    .select(
      'id, slug, titre, prix_cents, devise, type_produit, modalite, duree_acces_jours, discord_role_id, actif, ordre',
    )
    .order('ordre');

  const liste = formations ?? [];

  return (
    <>
      <EnTete
        titre="Catalogue"
        description={`${liste.filter((f) => f.actif).length} produits publiés sur ${liste.length}`}
        action={
          <Link
            href="/admin/formations/nouveau"
            className="rounded-douce bg-accent px-4 py-2 text-sm font-semibold text-accent-contraste hover:bg-accent-fort"
          >
            Nouveau produit
          </Link>
        }
      />

      {liste.length ? (
        <div className="rounded-carte border border-filet bg-fond p-5">
          <Tableau
            colonnes={[
              'Produit',
              'Type',
              'Suivi',
              'Tarif',
              'Durée d’accès',
              'Rôle Discord',
              'État',
            ]}
            largeurMin="66rem"
          >
            {liste.map((f) => (
              <tr key={f.id} className="border-b border-filet last:border-0">
                <td className="py-2.5 pr-4">
                  <Link href={`/admin/formations/${f.id}`} className="font-medium hover:underline">
                    {f.titre}
                  </Link>
                  <span className="block font-mono text-xs text-encre-faible">/{f.slug}</span>
                </td>
                <td className="py-2.5 pr-4">{TYPES[f.type_produit] ?? f.type_produit}</td>
                <td className="py-2.5 pr-4 text-encre-doux">
                  {f.modalite === 'individuel' ? 'Individuel' : 'Groupe'}
                </td>
                <td className="py-2.5 pr-4 tabular-nums">
                  {formaterMontant(f.prix_cents, f.devise)}
                  {f.type_produit === 'abonnement' && (
                    <span className="text-xs text-encre-doux"> / mois</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-encre-doux">
                  {f.duree_acces_jours ? `${f.duree_acces_jours} jours` : 'illimité'}
                </td>
                <td className="py-2.5 pr-4">
                  {f.discord_role_id ? (
                    <span className="font-mono text-xs text-encre-faible">{f.discord_role_id}</span>
                  ) : (
                    <Pastille ton="probleme">aucun</Pastille>
                  )}
                </td>
                <td className="py-2.5">
                  <Pastille ton={f.actif ? 'bon' : 'neutre'}>
                    {f.actif ? 'Publié' : 'Brouillon'}
                  </Pastille>
                </td>
              </tr>
            ))}
          </Tableau>
        </div>
      ) : (
        <Vide>Le catalogue est vide.</Vide>
      )}

      <p className="text-sm text-encre-doux">
        Un produit ne peut pas être publié sans rôle Discord : il encaisserait un paiement sans
        ouvrir d’accès. Un brouillon, si — le temps de créer le rôle.
      </p>
    </>
  );
}
