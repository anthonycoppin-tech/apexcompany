import { ImageResponse } from 'next/og';

/**
 * L'image qui s'affiche quand un lien du site est partagé.
 *
 * Elle attendait la charte depuis le 9 septembre (`docs/08-CE-QUI-MANQUE.md`)
 * et la charte est arrivée le 23. Sans elle, un lien collé dans WhatsApp, sur
 * un réseau ou dans un message privé apparaît comme un rectangle vide — sur un
 * site dont c'est justement le canal d'acquisition principal.
 *
 * **Dessinée en code, pas déposée en fichier.** Un PNG dans le dépôt vieillit
 * en silence : la charte change, l'image reste, et personne ne s'en aperçoit
 * avant qu'un client ne partage un lien. Ici les trois arrêts du dégradé sont
 * ceux de `globals.css`, et le jour où ils bougent, l'image bouge avec eux.
 *
 * **Recopiés à la main, et c'est assumé** : `ImageResponse` rend l'image dans
 * un moteur isolé qui n'a ni feuille de style ni variables CSS. C'est la même
 * exception que `lib/email/modeles.ts` et `lib/facture/modele.ts`, pour la même
 * raison — sauf qu'ici le commentaire dit d'où viennent les valeurs.
 */

export const alt = 'ApexCompany — rigueur cognitive et technique';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// `--color-degrade-debut`, `-milieu`, `-fin`, puis `--color-encre`. À garder
// alignés sur `app/globals.css`.
const DEGRADE_DEBUT = '#111bcc';
const DEGRADE_MILIEU = '#3416e8';
const DEGRADE_FIN = '#9201cf';
const ENCRE = '#f4f5ff';
const ENCRE_DOUX = '#d5d8f5';

/**
 * Archivo, en gras et en italique — la fonte de la bannière.
 *
 * **Sans elle, l'image ne porte pas la marque.** Le moteur de rendu n'embarque
 * qu'une seule fonte et une seule graisse : `fontWeight: 800` y est ignoré en
 * silence, et le titre sort en capitales fines et génériques. Vu à l'écran
 * avant de l'écrire — c'est exactement le genre de défaut qu'aucun typecheck
 * ne rattrape.
 *
 * Le détour par la feuille de style de Google est volontaire : elle donne
 * l'adresse du fichier pour la graisse demandée, là où une adresse écrite en
 * dur casse au prochain remaniement de leur dépôt. L'en-tête de navigateur
 * ancien fait répondre du TTF plutôt que du WOFF2, que le moteur ne lit pas.
 *
 * **Si le réseau ne répond pas, on rend l'image quand même** : une image
 * imparfaite vaut mieux qu'un build cassé pour un aplat décoratif, et mieux
 * qu'un rectangle vide au partage.
 */
async function archivo(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Archivo:ital,wght@1,800&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1)' } },
    ).then((r) => (r.ok ? r.text() : ''));

    const adresse = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    if (!adresse) return null;

    const fonte = await fetch(adresse);
    return fonte.ok ? await fonte.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const fonte = await archivo();

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 96px',
        backgroundImage: `linear-gradient(100deg, ${DEGRADE_DEBUT} 0%, ${DEGRADE_MILIEU} 42%, ${DEGRADE_FIN} 100%)`,
        color: ENCRE,
        fontFamily: fonte ? 'Archivo' : 'sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 108,
          fontWeight: 800,
          // Positif, comme `.titre-banniere` : le resserrement des titres
          // courants est juste pour des bas-de-casse et colle des capitales.
          letterSpacing: '0.01em',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        ApexCompany
      </div>

      <div style={{ marginTop: 28, fontSize: 40, fontWeight: 800, color: ENCRE_DOUX }}>
        Rigueur cognitive et technique
      </div>

      <div
        style={{
          marginTop: 56,
          width: 132,
          height: 6,
          backgroundColor: ENCRE,
          borderRadius: 3,
        }}
      />
    </div>,
    {
      ...size,
      ...(fonte
        ? {
            fonts: [
              { name: 'Archivo', data: fonte, weight: 800 as const, style: 'italic' as const },
            ],
          }
        : {}),
    },
  );
}
