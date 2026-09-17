import Link from 'next/link';

import { EnTete } from '@/components/admin';
import { BoutonAction, CHAMP } from '@/components/ui';
import { jourParis } from '@/lib/format';

export const metadata = { title: 'Exports' };

const EXPORTS = [
  {
    type: 'paiements',
    titre: 'Paiements',
    description: 'Chaque encaissement, avec le client, le produit et les références Stripe.',
  },
  {
    type: 'remboursements',
    titre: 'Remboursements',
    description: 'Les demandes et leur exécution, avec la référence du paiement d’origine.',
  },
  {
    type: 'factures',
    titre: 'Factures',
    description: 'Les factures émises, dans l’ordre de leur numéro.',
  },
  {
    type: 'prospects',
    titre: 'Prospects',
    description: 'Les formulaires reçus : coordonnées, réseau, réponses, formateur affecté.',
  },
] as const;

/** Premier et dernier jour d'un mois, décalé de `ecart` mois depuis celui de `jour`. */
function mois(jour: string, ecart: number) {
  const [a, m] = jour.split('-').map(Number);
  const debut = new Date(Date.UTC(a, m - 1 + ecart, 1));
  const fin = new Date(Date.UTC(a, m + ecart, 0));
  return { du: debut.toISOString().slice(0, 10), au: fin.toISOString().slice(0, 10) };
}

/**
 * `/admin/exports` — ce qu'on envoie au comptable.
 *
 * Des fichiers CSV qui s'ouvrent tels quels dans Excel (point-virgule, montants
 * en euros à virgule, accents intacts). Les prospects y figurent aussi : ce
 * sont des données personnelles, et le fichier téléchargé sort du périmètre de
 * ce que la plateforme protège — à ne transmettre qu'à qui en a besoin.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ du?: string; au?: string }>;
}) {
  const parametres = await searchParams;
  const aujourdhui = jourParis();
  const courant = mois(aujourdhui, 0);
  const valide = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const du = valide(parametres.du) ?? courant.du;
  const au = valide(parametres.au) ?? aujourdhui;

  const raccourcis = [
    { libelle: 'Mois en cours', ...courant, au: aujourdhui },
    { libelle: 'Mois précédent', ...mois(aujourdhui, -1) },
    { libelle: 'Année en cours', du: `${aujourdhui.slice(0, 4)}-01-01`, au: aujourdhui },
  ];

  return (
    <>
      <EnTete
        titre="Exports"
        description="Des fichiers CSV pour la comptabilité et le suivi commercial. Les dates s’entendent à Paris, bornes incluses."
      />

      <section className="space-y-4 rounded-carte border border-filet bg-fond p-5">
        <form className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-encre-doux">Du</span>
            <input type="date" name="du" defaultValue={du} max={aujourdhui} className={CHAMP} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-encre-doux">Au</span>
            <input type="date" name="au" defaultValue={au} max={aujourdhui} className={CHAMP} />
          </label>
          <BoutonAction type="submit" variante="secondaire" className="px-4 py-2">
            Choisir cette période
          </BoutonAction>
        </form>
        <div className="flex flex-wrap gap-2 text-sm">
          {raccourcis.map((r) => (
            <Link
              key={r.libelle}
              href={`/admin/exports?du=${r.du}&au=${r.au}`}
              aria-current={r.du === du && r.au === au ? 'true' : undefined}
              className="rounded-douce border border-filet px-3 py-1.5 text-encre-doux hover:bg-surface aria-[current]:border-encre aria-[current]:text-encre"
            >
              {r.libelle}
            </Link>
          ))}
        </div>
        <p className="text-sm text-encre-doux">
          Période retenue : du{' '}
          <strong className="text-encre">{du.split('-').reverse().join('/')}</strong> au{' '}
          <strong className="text-encre">{au.split('-').reverse().join('/')}</strong>.
        </p>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2">
        {EXPORTS.map((e) => (
          <li
            key={e.type}
            className="flex flex-col justify-between gap-4 rounded-carte border border-filet bg-fond p-5"
          >
            <div className="space-y-1">
              <h2 className="font-semibold">{e.titre}</h2>
              <p className="text-sm text-encre-doux">{e.description}</p>
            </div>
            {/* Un lien et non un bouton : c'est un téléchargement, que le
                navigateur gère seul, sans quitter la page. */}
            <a
              href={`/api/exports/${e.type}?du=${du}&au=${au}`}
              download
              className="self-start text-sm font-semibold text-accent hover:underline"
            >
              Télécharger le CSV →
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
