import { ConversionReseaux } from '@/components/conversion-reseaux';

export const metadata = { title: 'Conversion par réseau' };

/** `/admin/reseaux` — la conversion par réseau, dans le back-office, avec son menu. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode } = await searchParams;
  return <ConversionReseaux periode={periode} chemin="/admin/reseaux" />;
}
