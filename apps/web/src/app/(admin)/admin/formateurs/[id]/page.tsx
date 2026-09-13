import { notFound } from 'next/navigation';

import { EnTete } from '@/components/admin';
import { createClient } from '@/lib/supabase/server';

import { comptesRattachables } from '../comptes';
import { FormulaireFiche } from '../formulaire';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [fiche, comptes] = await Promise.all([
    supabase
      .from('formateurs_fiches')
      .select('id, nom, fonction, biographie, specialites, photo_url, user_id, publie, ordre')
      .eq('id', id)
      .maybeSingle(),
    comptesRattachables(supabase),
  ]);

  if (!fiche.data) notFound();

  return (
    <>
      <EnTete
        titre={fiche.data.nom}
        description={
          fiche.data.publie ? 'Affichée sur « L’équipe »' : 'Brouillon, invisible du site'
        }
      />
      <FormulaireFiche fiche={fiche.data} comptes={comptes} />
    </>
  );
}
