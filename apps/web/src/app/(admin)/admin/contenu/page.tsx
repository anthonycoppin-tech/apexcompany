import Link from 'next/link';

import { EnTete } from '@/components/admin';
import { Temoignages } from '@/components/temoignages';
import { Carte } from '@/components/ui';

import { FICHES_EXEMPLE, TEMOIGNAGES_EXEMPLE } from './exemples';

/**
 * `/admin/contenu` — ce qu'on attend du client, montré plutôt que décrit.
 *
 * Le site est prêt à recevoir des témoignages et des biographies ; personne ne
 * sait quoi écrire tant qu'on n'a pas vu à quoi ça ressemble. Cette page rend
 * **les vraies sections du site public** avec des exemples fictifs, pour que la
 * forme et la longueur attendues se voient d'un coup d'œil.
 *
 * **Les exemples ne quittent pas cet écran.** Ils ne sont pas en base, aucune
 * page publique ne les importe, et chaque nom porte « (exemple) ». Le dépôt
 * pose partout qu'inventer du contenu sur un site de formation à
 * l'investissement est un risque : montrer un exemple pour expliquer ce qu'on
 * attend n'est pas la même chose que l'afficher au public.
 */
export default function Page() {
  return (
    <>
      <EnTete
        titre="Guide de contenu"
        description="À quoi ressemblera le site une fois rempli, et ce qu’il faut nous envoyer."
      />

      <div className="rounded-carte border border-accent bg-accent-doux p-5">
        <p className="font-semibold text-accent">Tout ce qui suit est fictif.</p>
        <p className="mt-1 text-sm leading-relaxed text-encre-doux">
          Ces exemples servent à montrer la forme attendue. Ils ne sont pas enregistrés, ne peuvent
          pas être publiés, et n’apparaissent nulle part sur le site.
        </p>
      </div>

      {/* ── Témoignages ─────────────────────────────────────────────────── */}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Témoignages</h2>
          <p className="text-sm text-encre-doux">
            Ils s’affichent sur l’accueil et sur la fiche du programme concerné.{' '}
            <Link href="/admin/temoignages" className="font-medium text-accent hover:underline">
              Les saisir →
            </Link>
          </p>
        </div>

        <Carte className="space-y-3">
          <h3 className="font-semibold">Ce qui fait un bon témoignage</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-encre-doux">
            <li>
              <strong className="text-encre">Un fait précis, pas un superlatif.</strong> « Je prends
              beaucoup moins de trades et je sais pourquoi » convainc ; « formation au top » ne
              convainc personne.
            </li>
            <li>
              <strong className="text-encre">Un avant et un après.</strong> D’où partait la
              personne, ce qui a changé concrètement dans sa façon de travailler.
            </li>
            <li>
              <strong className="text-encre">Aucune promesse de gain.</strong> Un témoignage qui
              cite un rendement ne peut pas être publié : c’est une allégation que la société
              devrait pouvoir justifier, et elle engage au-delà de son auteur.
            </li>
            <li>
              <strong className="text-encre">Un accord écrit de la personne.</strong> Ce sont son
              nom et ses mots. Sans cet accord, la publication est refusée par l’écran de saisie et
              par la base — ce n’est pas contournable.
            </li>
            <li>Trois à cinq lignes suffisent. Un prénom et une initiale suffisent aussi.</li>
          </ul>
        </Carte>

        {/* La vraie section du site, avec des exemples : c'est ce rendu-là qui
            fait comprendre la longueur attendue, mieux qu'une consigne. */}
        <div className="overflow-hidden rounded-carte border border-filet">
          <Temoignages temoignages={TEMOIGNAGES_EXEMPLE} fond="page" />
        </div>
      </section>

      {/* ── Fiches formateurs ───────────────────────────────────────────── */}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Fiches formateurs</h2>
          <p className="text-sm text-encre-doux">
            Elles remplissent la page « L’équipe », qui ne présente aujourd’hui personne.{' '}
            <Link href="/admin/formateurs" className="font-medium text-accent hover:underline">
              Les saisir →
            </Link>
          </p>
        </div>

        <Carte className="space-y-3">
          <h3 className="font-semibold">Ce qu’il nous faut par personne</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-encre-doux">
            <li>
              <strong className="text-encre">Le nom affiché et la fonction.</strong> « Directeur de
              l’accompagnement », « Formatrice technique ».
            </li>
            <li>
              <strong className="text-encre">Une biographie qui répond à une seule question</strong>{' '}
              : à qui vais-je avoir affaire ? Le parcours, ce qu’on aime faire, comment on
              travaille. Trois à six lignes.
            </li>
            <li>
              <strong className="text-encre">Deux ou trois spécialités.</strong> Elles s’affichent
              en étiquettes sous la biographie.
            </li>
            <li>
              <strong className="text-encre">Une photo.</strong> De face, cadrée sur le visage,
              carrée de préférence — elle s’affiche en rond. Une adresse web, pas un fichier joint.
            </li>
            <li>
              Là aussi, <strong className="text-encre">aucune promesse de résultat</strong> ni
              performance chiffrée.
            </li>
          </ul>
        </Carte>

        <div className="grid gap-4 md:grid-cols-2">
          {FICHES_EXEMPLE.map((f, i) => (
            <Carte key={i} className="space-y-4">
              <div className="flex items-center gap-4">
                <div
                  aria-hidden
                  className="flex h-16 w-16 flex-none items-center justify-center rounded-full border border-dashed border-filet-fort text-xs text-encre-faible"
                >
                  photo
                </div>
                <div className="space-y-0.5">
                  <p className="font-bold">{f.nom}</p>
                  <p className="text-sm text-encre-doux">{f.fonction}</p>
                </div>
              </div>
              <p className="leading-relaxed text-encre-doux">{f.biographie}</p>
              <ul className="flex flex-wrap gap-2 border-t border-filet pt-4">
                {f.specialites.map((s) => (
                  <li
                    key={s}
                    className="rounded-douce bg-accent-doux px-2.5 py-1 text-xs font-medium text-accent"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </Carte>
          ))}
        </div>
      </section>

      {/* ── Le reste ────────────────────────────────────────────────────── */}

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Ce qui manque encore, et qui n’est pas ici</h2>
        <Carte className="space-y-3 text-sm leading-relaxed text-encre-doux">
          <p>
            <strong className="text-encre">Les quatre chiffres de l’accueil</strong> — « 80+
            apprenants », « 9/10 », « 100 % recommandent », « 24 h de délai ». Ils ne s’affichent
            plus : un chiffre a besoin d’une source et d’une date de relevé, sans quoi il ne se
            défend pas. Donnez-nous d’où ils sortent et de quand, ils reviennent.
          </p>
          <p>
            <strong className="text-encre">Le catalogue réel</strong> — les produits en base sont
            encore ceux d’une version précédente, donc les tarifs et les formats affichés sont faux.
          </p>
          <p>
            <strong className="text-encre">Les informations de la société</strong> — les six pages
            légales sont vides et ne peuvent pas être écrites sans savoir laquelle des deux sociétés
            vend aux clients finaux.
          </p>
          <p>
            La liste complète, avec ce qui ne fonctionne pas sans chaque élément, est dans{' '}
            <span className="font-mono text-xs">docs/08-CE-QUI-MANQUE.md</span>.
          </p>
        </Carte>
      </section>
    </>
  );
}
