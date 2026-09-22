import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { factureHtml, ventilation, type DonneesFacture } from './modele.ts';

const base: DonneesFacture = {
  numero: 'F-2026-000042',
  emiseLe: '2026-10-01T10:00:00Z',
  client: { nom: 'Camille Martin', email: 'camille@exemple.fr' },
  produit: 'Accélérateur',
  typeProduit: 'accompagnement',
  montantCents: 249_000,
  devise: 'EUR',
  tva: null,
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

  it('dit que la TVA est en attente plutôt que d’en inventer une', () => {
    const html = factureHtml(base);
    assert.match(html, /Mention de TVA en attente/);
    assert.doesNotMatch(html, /Total HT/);
  });

  it('ventile HT et TVA quand le régime est connu', () => {
    const html = factureHtml({
      ...base,
      tva: { tauxPourcent: 20, mention: 'TVA acquittée via le guichet unique.' },
    });
    assert.match(html, /Total HT/);
    assert.match(html, /TVA 20 %/);
    assert.doesNotMatch(html, /en attente/);
  });

  it('ventile en centimes entiers qui retombent sur le prix payé', () => {
    for (const [ttc, taux] of [
      [249_000, 20],
      [99_999, 19],
      [1, 21],
      [4_700, 5.5],
    ] as const) {
      const v = ventilation(ttc, taux);
      assert.ok(Number.isInteger(v.htCents) && Number.isInteger(v.tvaCents));
      assert.equal(v.htCents + v.tvaCents, ttc);
    }
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
