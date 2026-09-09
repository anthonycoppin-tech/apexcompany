/**
 * Un bloc de données structurées (JSON-LD), lu par les moteurs de recherche.
 *
 * L'échappement de `<` n'est pas cosmétique. `JSON.stringify` recopie les
 * valeurs telles quelles : un titre de programme contenant `</script>`, saisi
 * depuis le back-office, fermerait la balise et permettrait d'injecter du HTML
 * dans toutes les fiches produit. `<` est la même chaîne pour un analyseur
 * JSON, et n'a plus aucun sens pour l'analyseur HTML.
 */
export function DonneesStructurees({ donnees }: { donnees: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees).replace(/</g, '\\u003c') }}
    />
  );
}
