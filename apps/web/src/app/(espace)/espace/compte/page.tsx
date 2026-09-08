import { createClient } from '@/lib/supabase/server';

import { FormulaireCompte } from './formulaire';

/**
 * `/espace/compte` — ses informations personnelles.
 *
 * Le profil se lit et s'écrit sous RLS (`profiles_lit_le_sien`,
 * `profiles_modifie_le_sien`), donc sans filtre à écrire ici.
 */
export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = await supabase
    .from('profiles')
    .select('prenom, nom, telephone, email')
    .maybeSingle();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Mon compte</h1>

      <FormulaireCompte
        prenom={profil?.prenom ?? null}
        nom={profil?.nom ?? null}
        telephone={profil?.telephone ?? null}
        email={profil?.email ?? user?.email ?? ''}
      />
    </div>
  );
}
