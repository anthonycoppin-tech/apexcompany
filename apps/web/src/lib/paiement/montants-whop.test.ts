import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { centsVersDecimal, decimalVersCents } from './montants-whop.ts';

describe('les centimes envoyés à Whop', () => {
  it('rend un montant décimal', () => {
    assert.equal(centsVersDecimal(29000), 290);
    assert.equal(centsVersDecimal(160000), 1600);
    assert.equal(centsVersDecimal(5900), 59);
  });

  it('garde les centimes non ronds', () => {
    assert.equal(centsVersDecimal(1999), 19.99);
    assert.equal(centsVersDecimal(5), 0.05);
    assert.equal(centsVersDecimal(0), 0);
  });

  it('refuse ce qui n’est pas un entier de centimes', () => {
    // Un flottant qui arrive ici est un bug en amont, pas une valeur à
    // arrondir en silence : l'arrondi masquerait l'endroit où le centime
    // s'est perdu.
    assert.throws(() => centsVersDecimal(19.99));
    assert.throws(() => centsVersDecimal(-100));
    assert.throws(() => centsVersDecimal(Number.NaN));
  });
});

describe('les montants rendus par Whop', () => {
  it('lit une chaîne décimale exacte', () => {
    assert.equal(decimalVersCents('290.00'), 29000);
    assert.equal(decimalVersCents('4800.00'), 480000);
    assert.equal(decimalVersCents('19.99'), 1999);
  });

  it('lit un montant sans décimale et à une seule décimale', () => {
    assert.equal(decimalVersCents('290'), 29000);
    assert.equal(decimalVersCents('19.9'), 1990);
  });

  it('ne passe jamais par le flottant', () => {
    // `parseFloat('19.99') * 100` vaut 1998.9999999999998. Le tour complet
    // doit rendre exactement ce qui est parti.
    for (const cents of [1999, 4999, 29000, 87990, 480000, 550000, 1, 7]) {
      assert.equal(decimalVersCents(String(centsVersDecimal(cents))), cents);
    }
  });

  it('arrondit une troisième décimale au centime le plus proche', () => {
    assert.equal(decimalVersCents('48.005'), 4801);
    assert.equal(decimalVersCents('48.004'), 4800);
  });

  it('lit un montant porté par un objet, comme sur un paiement', () => {
    assert.equal(decimalVersCents({ amount: '290.00' }), 29000);
    assert.equal(decimalVersCents({ value: 59 }), 5900);
  });

  it('rend null plutôt qu’un zéro inventé quand il ne sait pas lire', () => {
    // La règle de la TVA, appliquée à tous les montants : un montant illisible
    // écrit comme 0 devient un encaissement à 0 €, une facture fausse et un
    // chiffre d'affaires faux, sans rien pour signaler d'où ça vient.
    for (const illisible of [null, undefined, '', 'gratuit', '-10.00', '1e3', '1,99', {}, []]) {
      assert.equal(decimalVersCents(illisible), null, `devrait refuser ${JSON.stringify(illisible)}`);
    }
  });
});
