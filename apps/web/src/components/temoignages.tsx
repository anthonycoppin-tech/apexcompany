import { Carte, Section, Surtitre } from '@/components/ui';

export type TemoignageAffiche = {
  id: string;
  auteur: string;
  contexte: string | null;
  contenu: string;
  note: number | null;
};

/**
 * La section des témoignages, partout où elle apparaît.
 *
 * Elle prend ses lignes en propriété plutôt que d'interroger la base
 * elle-même : l'accueil les veut toutes, une fiche produit ne veut que les
 * siennes, et le guide de contenu du back-office lui passe des exemples pour
 * montrer au client à quoi ressemblera la page une fois remplie.
 *
 * **Elle ne s'affiche pas quand il n'y a rien.** Un bandeau « ils en parlent »
 * au-dessus du vide est pire que son absence, et la RLS garantit déjà qu'un
 * témoignage non publié n'arrive jamais jusqu'ici.
 *
 * Aucune note moyenne agrégée n'est calculée ni affichée. Un chiffre de
 * synthèse est une allégation commerciale qui demande une méthode et une date ;
 * une note portée par un avis nommé n'engage que cet avis.
 */
export function Temoignages({
  temoignages,
  titre = 'Ce qu’en disent les membres',
  fond = 'surface',
}: {
  temoignages: TemoignageAffiche[];
  titre?: string;
  fond?: 'page' | 'surface';
}) {
  if (temoignages.length === 0) return null;

  return (
    <Section fond={fond}>
      <div className="space-y-10">
        <div className="max-w-2xl space-y-3">
          <Surtitre>Témoignages</Surtitre>
          <h2 className="text-3xl font-extrabold sm:text-4xl">{titre}</h2>
        </div>

        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {temoignages.map((t) => (
            <li key={t.id}>
              <Carte className="flex h-full flex-col gap-4">
                {t.note !== null && (
                  <p className="text-sm font-semibold text-accent tabular-nums">
                    {t.note}/5
                    <span className="sr-only"> — note donnée par cette personne</span>
                  </p>
                )}

                {/* `blockquote` parce que c'en est une : ce sont les mots de
                    quelqu'un d'autre, et un lecteur d'écran l'annonce comme tel. */}
                <blockquote className="flex-1 leading-relaxed text-encre-doux">
                  {t.contenu}
                </blockquote>

                <footer className="border-t border-filet pt-4 text-sm">
                  <p className="font-semibold">{t.auteur}</p>
                  {t.contexte && <p className="text-encre-doux">{t.contexte}</p>}
                </footer>
              </Carte>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
