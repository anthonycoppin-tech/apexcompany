import { METADONNEES_LEGALES, PageLegale } from '@/components/page-legale';

export const metadata = { title: 'Mentions légales', ...METADONNEES_LEGALES };

export default function Page() {
  return (
    <PageLegale
      titre="Mentions légales"
      contiendra="Qui édite ce site et qui l’héberge : raison sociale, forme juridique, adresse, immatriculation, directeur de la publication, et les coordonnées de l’hébergeur."
    />
  );
}
