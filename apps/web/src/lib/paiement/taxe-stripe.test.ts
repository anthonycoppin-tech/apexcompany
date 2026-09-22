import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { taxeDeFacture, taxeDeSession } from './taxe-stripe.ts';

const actif = { enabled: true, status: 'complete' };

describe('la TVA lue dans une session de paiement', () => {
  it('rend le montant et le pays calculés par Stripe Tax', () => {
    assert.deepEqual(
      taxeDeSession({
        automatic_tax: actif,
        total_details: { amount_tax: 233 },
        customer_details: { address: { country: 'ae' } },
      }),
      { tvaCents: 233, pays: 'AE' },
    );
  });

  it('garde un zéro calculé : un client hors des Émirats ne paie aucune TVA', () => {
    assert.deepEqual(
      taxeDeSession({
        automatic_tax: actif,
        total_details: { amount_tax: 0 },
        customer_details: { address: { country: 'FR' } },
      }),
      { tvaCents: 0, pays: 'FR' },
    );
  });

  it('ne transforme jamais un calcul absent en TVA nulle', () => {
    for (const automatic_tax of [
      null,
      { enabled: false, status: null },
      { enabled: true, status: 'requires_location_inputs' },
    ]) {
      assert.deepEqual(taxeDeSession({ automatic_tax, total_details: { amount_tax: 0 } }), {
        tvaCents: null,
        pays: null,
      });
    }
  });
});

describe('la TVA lue dans une facture de renouvellement', () => {
  it('additionne les taxes de la facture', () => {
    assert.deepEqual(
      taxeDeFacture({
        automatic_tax: actif,
        total_taxes: [{ amount: 200 }, { amount: 33 }],
        customer_address: { country: 'AE' },
      }),
      { tvaCents: 233, pays: 'AE' },
    );
  });

  it('rend null pour un prélèvement sans calcul automatique', () => {
    assert.deepEqual(taxeDeFacture({ total_taxes: [] }), { tvaCents: null, pays: null });
  });

  it('écarte un pays qui n’est pas un code à deux lettres', () => {
    assert.equal(
      taxeDeFacture({ automatic_tax: actif, total_taxes: [], customer_address: { country: 'FRA' } })
        .pays,
      null,
    );
  });
});
