import type { ReactNode } from 'react';

/**
 * Coquille du site public. Nav et footer sont des placeholders volontaires —
 * le design system (couleurs, typographie, composants) reste à construire ;
 * ne pas s'appuyer sur ce fichier comme référence visuelle.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b p-4">
        <span className="font-semibold">ApexCompany</span>
      </header>
      <main className="flex-1 p-6">{children}</main>
      <footer className="border-t p-4 text-sm text-neutral-500">
        © {new Date().getFullYear()} ApexCompany
      </footer>
    </div>
  );
}
