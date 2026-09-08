'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { Database } from '@apex/db';

import { createClient } from '@/lib/supabase/server';

type TypeProduit = Database['public']['Enums']['type_produit'];
type Modalite = Database['public']['Enums']['modalite_formation'];

export type EtatFormation = { readonly erreur: string | null; readonly ok: boolean };

const TYPES: TypeProduit[] = ['abonnement', 'accompagnement', 'formation'];
const MODALITES: Modalite[] = ['individuel', 'groupe'];

const entierOuNull = (valeur: string): number | null => {
  const propre = valeur.trim();
  if (!propre) return null;
  const n = Number(propre);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
};

/**
 * Créer ou modifier un produit du catalogue.
 *
 * Cet écran touche à trois choses qui cassent en silence quand elles sont
 * fausses : **le prix**, **le type de produit** et **le rôle Discord**. D'où une
 * validation qui refuse tôt et explique, plutôt que de laisser remonter une
 * erreur de contrainte que personne ne sait lire.
 *
 * Deux règles méritent leur place ici plutôt qu'en base :
 *
 * **La cohérence entre le type et la durée d'accès** est bien garantie par la
 * contrainte `formations_duree_acces_coherente` — c'est la base qui a le dernier
 * mot. Mais un message clair vaut mieux qu'un code d'erreur `23514` : la
 * vérification est donc doublée ici, pour dire *pourquoi* c'est refusé.
 *
 * **Un produit publié doit déclarer son rôle Discord.** Celle-là n'existe nulle
 * part ailleurs, et elle évite le pire scénario du système : un produit qui se
 * vend, s'encaisse, ouvre une inscription et n'ouvre aucun accès. Le client
 * paie et n'a rien ; l'échec ne se voit que dans le journal des automatisations.
 * On peut préparer un brouillon sans rôle, on ne peut pas le publier.
 */
export async function enregistrerFormation(
  _precedent: EtatFormation,
  donnees: FormData,
): Promise<EtatFormation> {
  const lu = (champ: string) => (donnees.get(champ) ?? '').toString().trim();

  const id = lu('id');
  const titre = lu('titre');
  const slug = lu('slug').toLowerCase();
  const typeProduit = lu('type_produit') as TypeProduit;
  const modalite = lu('modalite') as Modalite;
  const actif = lu('actif') === 'on';
  const discordRoleId = lu('discord_role_id');

  if (!titre) return { erreur: 'Le titre est nécessaire.', ok: false };

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return {
      erreur:
        'L’adresse (slug) ne peut contenir que des minuscules, des chiffres et des tirets — sans tiret au début ni à la fin.',
      ok: false,
    };
  }

  if (!TYPES.includes(typeProduit)) return { erreur: 'Type de produit inconnu.', ok: false };
  if (!MODALITES.includes(modalite)) return { erreur: 'Modalité inconnue.', ok: false };

  // Saisi en euros, stocké en centimes. L'argent est un entier partout, et la
  // conversion se fait à la frontière plutôt que de laisser filer un flottant.
  const prixEuros = Number(lu('prix_euros').replace(',', '.'));
  if (!Number.isFinite(prixEuros) || prixEuros < 0) {
    return { erreur: 'Le tarif n’est pas un montant valide.', ok: false };
  }
  const prixCents = Math.round(prixEuros * 100);

  const dureeAcces = entierOuNull(lu('duree_acces_jours'));
  const dureeSemaines = entierOuNull(lu('duree_semaines'));
  const volumeHoraire = entierOuNull(lu('volume_horaire'));
  const ordre = entierOuNull(lu('ordre')) ?? 0;

  if (Number.isNaN(dureeAcces) || Number.isNaN(dureeSemaines) || Number.isNaN(volumeHoraire)) {
    return { erreur: 'Les durées doivent être des nombres entiers positifs.', ok: false };
  }

  // La même règle qu'en base, dite en français.
  if (typeProduit === 'accompagnement' && (dureeAcces === null || dureeAcces === 0)) {
    return {
      erreur:
        'Un accompagnement doit déclarer sa durée d’accès en jours — c’est elle qui fixe la date de fin.',
      ok: false,
    };
  }

  if (typeProduit !== 'accompagnement' && dureeAcces !== null) {
    return {
      erreur:
        typeProduit === 'formation'
          ? 'Une formation donne un accès illimité : elle ne peut pas porter de durée d’accès.'
          : 'Un abonnement voit sa date d’accès repoussée à chaque prélèvement : il ne porte pas de durée fixe.',
      ok: false,
    };
  }

  if (actif && !discordRoleId) {
    return {
      erreur:
        'Un produit publié doit déclarer son rôle Discord, sinon il encaisse un paiement sans ouvrir d’accès. Enregistre-le en brouillon le temps de créer le rôle.',
      ok: false,
    };
  }

  const supabase = await createClient();

  const valeurs = {
    titre,
    slug,
    description: lu('description') || null,
    objectifs_pedagogiques: lu('objectifs_pedagogiques') || null,
    prerequis: lu('prerequis') || null,
    type_produit: typeProduit,
    modalite,
    prix_cents: prixCents,
    duree_acces_jours: dureeAcces,
    duree_semaines: dureeSemaines,
    volume_horaire: volumeHoraire,
    discord_role_id: discordRoleId || null,
    actif,
    ordre,
  };

  // Écrit sous RLS : `formations_staff_ecrit` réserve l'écriture au staff. Un
  // formateur qui appellerait cette action se ferait refuser par le moteur.
  const { data, error } = id
    ? await supabase.from('formations').update(valeurs).eq('id', id).select('id').single()
    : await supabase.from('formations').insert(valeurs).select('id').single();

  if (error) {
    const slugPris = error.code === '23505';

    return {
      erreur: slugPris
        ? 'Cette adresse (slug) est déjà utilisée par un autre produit.'
        : 'L’enregistrement a échoué. Réessaie dans un instant.',
      ok: false,
    };
  }

  revalidatePath('/admin/formations');
  revalidatePath('/formations');
  revalidatePath(`/formations/${slug}`);

  // Une création renvoie vers la fiche d'édition : rester sur un formulaire
  // vide après avoir créé un produit laisse croire que rien ne s'est passé.
  if (!id) redirect(`/admin/formations/${data.id}`);

  return { erreur: null, ok: true };
}
