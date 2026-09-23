import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dureeAcces } from './libelles.ts';

describe('la durée d’accès affichée', () => {
  it('dit les mois que le catalogue vend', () => {
    // PALACE 1, 2, 3 et MATRIX 3.0, tels que le client les annonce.
    assert.equal(dureeAcces(30), '1 mois');
    assert.equal(dureeAcces(60), '2 mois');
    assert.equal(dureeAcces(90), '3 mois');
    assert.equal(dureeAcces(180), '6 mois');
  });

  it('reste en jours quand ce n’est pas un mois entier', () => {
    // Plutôt que d'arrondir un mois et demi à deux mois : sur une durée
    // d'accès payée, un arrondi vers le haut est une promesse qu'on ne tient
    // pas, et vers le bas une vente qu'on se refuse.
    assert.equal(dureeAcces(45), '45 jours');
    assert.equal(dureeAcces(7), '7 jours');
    assert.equal(dureeAcces(1), '1 jour');
  });
});
