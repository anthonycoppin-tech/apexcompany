import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { taxeDePaiement } from './taxe-whop.ts';

describe('la TVA lue dans un paiement Whop', () => {
  it('rend le montant et le pays calculés par Whop', () => {
    assert.deepEqual(taxeDePaiement({ tax_amount: '2.33', billing_address: { country: 'ae' } }), {
      tvaCents: 233,
      pays: 'AE',
    });
  });

  it('lit un montant porté par un objet', () => {
    assert.deepEqual(
      taxeDePaiement({ tax_amount: { amount: '48.00' }, billing_address: { country: 'FR' } }),
      { tvaCents: 4800, pays: 'FR' },
    );
  });

  it('garde un zéro calculé : c’est une information, pas une absence', () => {
    assert.deepEqual(taxeDePaiement({ tax_amount: '0.00', billing_address: { country: 'FR' } }), {
      tvaCents: 0,
      pays: 'FR',
    });
  });

  it('ne transforme jamais un calcul absent en TVA nulle', () => {
    const inconnue = { tvaCents: null, pays: null };
    assert.deepEqual(taxeDePaiement({}), inconnue);
    assert.deepEqual(taxeDePaiement({ tax_amount: null }), inconnue);
    assert.deepEqual(taxeDePaiement({ tax_amount: 'n/a' }), inconnue);
  });

  it('écarte un pays qui n’est pas un code à deux lettres', () => {
    assert.deepEqual(
      taxeDePaiement({ tax_amount: '1.00', billing_address: { country: 'France' } }),
      {
        tvaCents: 100,
        pays: null,
      },
    );
  });

  it('ignore l’adresse de livraison : c’est la facturation qui fait la TVA', () => {
    assert.deepEqual(taxeDePaiement({ tax_amount: '1.00', shipping_address: { country: 'BE' } }), {
      tvaCents: 100,
      pays: null,
    });
  });
});
