import { EnTete } from '@/components/admin';
import { createClient } from '@/lib/supabase/server';

import { FormulaireTemoignage } from '../formulaire';

export default async function Page() {
  const supabase = await createClient();

  // Tous les produits, brouillons compris : un témoignage peut concerner un
  // programme qu'on n'a pas encore remis en vente.
  const { data: formations } = await supabase.from('formations').select('id, titre').order('ordre');

  return (
    <>
      <EnTete
        titre="Nouveau témoignage"
        description="Il restera invisible tant qu’il n’est pas publié."
      />
      <FormulaireTemoignage formations={formations ?? []} />
    </>
  );
}
