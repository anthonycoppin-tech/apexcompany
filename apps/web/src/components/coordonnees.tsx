import { numeroWhatsApp } from '@/lib/formateur/suivi';

/**
 * Les moyens de joindre quelqu'un, en boutons.
 *
 * Posés partout où un formateur peut avoir besoin de décrocher — la fiche, le
 * prochain audit, la liste des rendez-vous, un accompagnement — et toujours
 * dans le même ordre, pour que le geste ne se cherche pas. `tel:` et `wa.me`
 * ouvrent directement l'appel sur un téléphone.
 */
export function Coordonnees({
  telephone,
  email,
  compact = false,
}: {
  telephone: string | null | undefined;
  email: string | null | undefined;
  compact?: boolean;
}) {
  const whatsapp = numeroWhatsApp(telephone);
  const bouton = `rounded-douce border border-filet font-medium transition-colors hover:bg-surface ${
    compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
  }`;

  if (!telephone && !email) {
    return <span className="text-sm text-encre-doux">Aucune coordonnée.</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {telephone && (
        <a href={`tel:${telephone.replace(/\s/g, '')}`} className={bouton}>
          Appeler · {telephone}
        </a>
      )}
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className={bouton}
        >
          WhatsApp
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={bouton}>
          {email}
        </a>
      )}
    </div>
  );
}
