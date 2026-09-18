import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  finAccesProche,
  paiementRecu,
  propositionRecue,
  relanceDiscord,
  type Email,
} from './modeles.ts';
import { peutReprendre, TENTATIVES_MAX } from './registre.ts';

const tous: Array<[string, Email]> = [
  [
    'paiement reçu',
    paiementRecu({
      prenom: 'Camille',
      produit: 'Accélérateur',
      montantCents: 249000,
      typeProduit: 'accompagnement',
      dateFinAcces: '2026-12-18',
      lienEspace: 'https://exemple.fr/espace',
    }),
  ],
  [
    'proposition reçue',
    propositionRecue({
      prenom: 'Camille',
      produit: 'Communauté',
      montantCents: 4900,
      typeProduit: 'abonnement',
      expireLe: null,
      lien: 'https://exemple.fr/espace/propositions/1',
    }),
  ],
  [
    'relance Discord',
    relanceDiscord({ prenom: null, produit: 'Fondations', lien: 'https://exemple.fr/espace' }),
  ],
  [
    'fin d’accès proche',
    finAccesProche({
      prenom: 'Camille',
      produit: 'Accélérateur',
      dateFin: '2026-12-18',
      lien: 'https://exemple.fr/espace',
    }),
  ],
];

describe('modèles d’email', () => {
  it('vouvoient, dans le sujet, le HTML et le texte', () => {
    // Le site vouvoie partout (décision du 16 septembre). Un « tu » glissé dans
    // un brouillon partirait tel quel dans la boîte du client.
    // Frontières Unicode : avec \b, « êtes » contiendrait « tes ».
    const tutoiement = /(?<!\p{L})(?:(?:tu|te|toi|ton|ta|tes)(?!\p{L})|t[’'])/iu;
    for (const [nom, e] of tous) {
      for (const partie of [e.sujet, e.texte]) {
        assert.doesNotMatch(partie, tutoiement, `${nom} : ${partie}`);
      }
    }
  });

  it('échappent ce qui vient de la base', () => {
    // Un titre de produit est saisi au back-office : il ne doit jamais devenir du HTML.
    const e = paiementRecu({
      prenom: '<b>Camille</b>',
      produit: 'Offre <script>alert(1)</script> & "plus"',
      montantCents: 100,
      typeProduit: 'formation',
      dateFinAcces: null,
      lienEspace: 'https://exemple.fr/espace?a=1&b="2"',
    });
    assert.doesNotMatch(e.html, /<script>|<b>Camille/);
    assert.match(e.html, /&lt;script&gt;/);
    assert.match(e.html, /href="https:\/\/exemple\.fr\/espace\?a=1&amp;b=&quot;2&quot;"/);
    // Le texte brut, lui, n'est pas du HTML : rien à échapper.
    assert.match(e.texte, /Offre <script>/);
  });

  it('n’annoncent une date que si la base en donne une', () => {
    const sansFin = paiementRecu({
      prenom: null,
      produit: 'Fondations',
      montantCents: 49700,
      typeProduit: 'formation',
      dateFinAcces: null,
      lienEspace: 'https://exemple.fr/espace',
    });
    assert.match(sansFin.texte, /sans date de fin/);
    assert.match(tous[0][1].texte, /jusqu’au 18 décembre 2026/);
    assert.match(tous[0][1].texte, /2 490,00 €/);
  });

  it('portent le lien en clair dans le texte brut', () => {
    for (const [nom, e] of tous) assert.match(e.texte, /https:\/\/exemple\.fr/, nom);
  });
});

describe('registre des envois', () => {
  const maintenant = new Date('2026-09-18T12:00:00Z');
  const ligne = (statut: string, tentatives: number, minutes: number) => ({
    statut,
    tentatives,
    updated_at: new Date(maintenant.getTime() - minutes * 60_000).toISOString(),
  });

  it('ne renvoie jamais un email parti', () => {
    assert.equal(peutReprendre(ligne('envoye', 1, 600), maintenant), false);
  });

  it('retente un échec, dans la limite des tentatives', () => {
    assert.equal(peutReprendre(ligne('echec', 1, 5), maintenant), true);
    assert.equal(peutReprendre(ligne('echec', TENTATIVES_MAX, 5), maintenant), false);
  });

  it('laisse une exécution en cours finir, et reprend une exécution morte', () => {
    assert.equal(peutReprendre(ligne('en_cours', 1, 10), maintenant), false);
    assert.equal(peutReprendre(ligne('en_cours', 1, 61), maintenant), true);
  });
});
