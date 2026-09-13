import { METADONNEES_LEGALES, PageLegale } from '@/components/page-legale';

export const metadata = { title: 'Politique de remboursement', ...METADONNEES_LEGALES };

export default function Page() {
  return (
    <PageLegale
      titre="Politique de remboursement"
      contiendra="Dans quels cas un remboursement est possible, sous quel délai le demander, ce qu’il advient de l’accès en cours, et sous combien de temps la somme est reversée."
    />
  );
}
