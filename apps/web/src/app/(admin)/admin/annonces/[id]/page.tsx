import { notFound } from 'next/navigation';

import { EnTete } from '@/components/admin';
import { jourParis } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

import { FormulaireAnnonce } from '../formulaire';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: annonce } = await supabase
    .from('annonces')
    .select(
      'id, surtitre, titre, texte, date_evenement, lien_url, lien_libelle, publiee, fin_affichage',
    )
    .eq('id', id)
    .maybeSingle();

  if (!annonce) notFound();

  // L'échéance est stockée comme l'instant où l'annonce disparaît — minuit le
  // lendemain. Le formulaire, lui, parle du dernier jour affiché.
  const dernierJour = jourParis(new Date(new Date(annonce.fin_affichage).getTime() - 1));
  const enLigne =
    annonce.publiee && new Date(annonce.fin_affichage).getTime() > new Date().getTime();

  return (
    <>
      <EnTete
        titre={annonce.titre}
        description={enLigne ? 'En ligne sur l’accueil' : 'Invisible du site'}
      />
      <FormulaireAnnonce annonce={{ ...annonce, dernier_jour: dernierJour }} />
    </>
  );
}
