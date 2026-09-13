import { METADONNEES_LEGALES, PageLegale } from '@/components/page-legale';

export const metadata = { title: 'Conditions générales de vente', ...METADONNEES_LEGALES };

export default function Page() {
  return (
    <PageLegale
      titre="Conditions générales de vente"
      contiendra="Ce que vous achetez exactement, à quel prix et pour combien de temps, comment un abonnement se résilie, ce que recouvre le droit de rétractation, et ce qui se passe en cas de désaccord."
    />
  );
}
