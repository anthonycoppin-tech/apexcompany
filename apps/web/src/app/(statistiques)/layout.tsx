import Link from 'next/link';
import type { ReactNode } from 'react';

import { BoutonDeconnexion } from '@/components/bouton-deconnexion';
import { Conteneur } from '@/components/ui';
import { estStaff, requireRole } from '@/lib/auth/roles';

/**
 * Garde d'accès : branding, admin et owner — la ligne « Statistiques de
 * conversion » de la matrice (docs/02-SITEMAP.md), hors formateur, qui a les
 * siennes dans `/formateur/statistiques`.
 *
 * Une page, pas un espace : `06-PERIMETRE.md` le demande explicitement pour le
 * branding. Elle vit hors de `(admin)` parce que la garde du back-office n'admet
 * que le staff, et l'élargir exposerait toute sa navigation. Ce que la page lit
 * reste borné par `stats_conversion()`, qui refuse tout autre rôle et ne renvoie
 * que des agrégats — jamais un nom, un email ou un téléphone.
 */
export default async function StatistiquesLayout({ children }: { children: ReactNode }) {
  const roles = await requireRole(['branding', 'admin', 'owner']);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-filet bg-fond">
        <Conteneur className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-4">
          <Link href="/statistiques" className="flex items-baseline gap-2">
            <span className="font-titre text-lg font-extrabold tracking-tight">
              Apex<span className="text-accent">Company</span>
            </span>
            <span className="text-sm text-encre-doux">statistiques</span>
          </Link>

          <div className="flex items-center gap-4">
            {estStaff(roles) && (
              <Link href="/admin" className="text-sm text-encre-doux hover:text-encre">
                Back-office
              </Link>
            )}
            <BoutonDeconnexion />
          </div>
        </Conteneur>
      </header>

      <main className="flex-1">
        <Conteneur className="py-10">{children}</Conteneur>
      </main>
    </div>
  );
}
