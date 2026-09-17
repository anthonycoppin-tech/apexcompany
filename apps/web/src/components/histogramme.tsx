/**
 * Des barres verticales, une série, une valeur par période.
 *
 * Une seule série, donc pas de légende : le titre de la section la nomme. La
 * valeur est écrite au-dessus de chaque barre non nulle — il y en a huit, pas
 * de quoi encombrer — et répétée au survol. L'ensemble est lu comme une image
 * décrite, avec toutes ses valeurs, par un lecteur d'écran.
 */
export function Histogramme({
  titre,
  points,
}: {
  titre: string;
  points: Array<{ libelle: string; valeur: number; detail?: string }>;
}) {
  const max = Math.max(1, ...points.map((p) => p.valeur));

  return (
    <div className="space-y-2">
      <div
        className="flex h-40 items-end gap-0.5 border-b border-filet"
        role="img"
        aria-label={`${titre} : ${points.map((p) => `${p.libelle} ${p.valeur}`).join(', ')}`}
      >
        {points.map((p) => (
          <div
            key={p.libelle}
            className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
            title={`${p.detail ?? p.libelle} : ${p.valeur}`}
          >
            <span className="text-xs text-encre-doux tabular-nums">{p.valeur || ''}</span>
            <span
              className="w-full max-w-10 rounded-t-[4px] bg-accent transition-opacity group-hover:opacity-80"
              style={{ height: `${(p.valeur / max) * 80}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-0.5" aria-hidden="true">
        {points.map((p) => (
          <span key={p.libelle} className="flex-1 text-center text-xs text-encre-faible">
            {p.libelle}
          </span>
        ))}
      </div>
    </div>
  );
}
