import { EnTete } from '@/components/admin';
import { createClient } from '@/lib/supabase/server';

import { FormulaireFiche } from '../formulaire';
import { comptesRattachables } from '../comptes';

export default async function Page() {
  const supabase = await createClient();
  const comptes = await comptesRattachables(supabase);

  return (
    <>
      <EnTete
        titre="Nouvelle fiche"
        description="Elle reste invisible du site tant qu’elle n’est pas affichée."
      />
      <FormulaireFiche comptes={comptes} />
    </>
  );
}
