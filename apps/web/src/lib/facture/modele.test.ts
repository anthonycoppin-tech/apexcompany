import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { factureHtml, tauxAffiche, type DonneesFacture } from './modele.ts';

const base: DonneesFacture = {
  numero: 'F-2026-000042',
  emiseLe: '2026-10-01T10:00:00Z',
  client: { nom: 'Camille Martin', email: 'camille@exemple.fr' },
  produit: 'Accélérateur',
  typeProduit: 'accompagnement',
  montantCents: 249_000,
  devise: 'EUR',
  tva: { tvaCents: 0, pays: 'FR' },
};

describe('la facture', () => {
  it('porte le vendeur, le numéro, le client et le montant', () => {
    const html = factureHtml(base);
    for (const attendu of [
      'APEX COMPANY L.L.C-FZ',
      '2645781.01',
      'TRN 105376842800001',
      'Facture F-2026-000042',
      'Camille Martin',
      'Accompagnement — Accélérateur',
      '2 490,00 €',
    ]) {
      assert.ok(html.includes(attendu), attendu);
    }
  });

  it('dit qu’aucune TVA n’est facturée quand le prestataire en calcule zéro', () => {
    const html = factureHtml(base);
    assert.match(html, /TVA 0 %/);
    assert.match(html, /Aucune TVA n’est facturée pour ce client \(FR\)/);
  });

  it('ventile HT et TVA émiratie quand il y en a', () => {
    // 5 % inclus dans 2 490 € : 118,57 € de TVA.
    const html = factureHtml({ ...base, tva: { tvaCents: 11_857, pays: 'AE' } });
    assert.match(html, /Total HT<\/td><td class="n">2 371,43 €/);
    assert.match(html, /TVA 5 %/);
    assert.match(html, /TVA des Émirats arabes unis/);
  });

  it('ne fait pas passer une TVA non calculée pour une TVA nulle', () => {
    const html = factureHtml({ ...base, tva: null });
    assert.match(html, /TVA non calculée/);
    assert.doesNotMatch(html, /TVA 0 %|Total HT/);
  });

  it('déduit le taux des montants, au dixième', () => {
    assert.equal(tauxAffiche(249_000, 11_857), '5');
    assert.equal(tauxAffiche(10_000, 0), '0');
    assert.equal(tauxAffiche(12_000, 2_000), '20');
    assert.equal(tauxAffiche(10_550, 550), '5,5');
  });

  it('échappe ce qui vient de la base', () => {
    const html = factureHtml({
      ...base,
      produit: '<script>x</script>',
      client: { nom: '<b>', email: null },
    });
    assert.doesNotMatch(html, /<script>x/);
    assert.doesNotMatch(html, /<b>/);
  });
});
