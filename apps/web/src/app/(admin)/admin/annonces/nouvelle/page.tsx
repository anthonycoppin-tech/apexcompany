import { EnTete } from '@/components/admin';

import { FormulaireAnnonce } from '../formulaire';

export default function Page() {
  return (
    <>
      <EnTete
        titre="Nouvelle annonce"
        description="Elle reste invisible tant qu’elle n’est pas publiée."
      />
      <FormulaireAnnonce />
    </>
  );
}
