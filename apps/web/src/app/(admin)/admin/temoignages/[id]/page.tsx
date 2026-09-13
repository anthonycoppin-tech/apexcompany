import { notFound } from 'next/navigation';

import { EnTete } from '@/components/admin';
import { createClient } from '@/lib/supabase/server';

import { FormulaireTemoignage } from '../formulaire';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [temoignage, formations] = await Promise.all([
    supabase
      .from('temoignages')
      .select('id, auteur, contexte, contenu, note, formation_id, consentement, publie, ordre')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('formations').select('id, titre').order('ordre'),
  ]);

  if (!temoignage.data) notFound();

  return (
    <>
      <EnTete
        titre={temoignage.data.auteur}
        description={temoignage.data.publie ? 'Publié sur le site' : 'Brouillon, invisible du site'}
      />
      <FormulaireTemoignage temoignage={temoignage.data} formations={formations.data ?? []} />
    </>
  );
}
