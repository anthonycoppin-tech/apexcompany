import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dureeAcces, libelleAbonnement, periodiciteAbonnement } from './libelles.ts';

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

describe('la périodicité affichée d’un abonnement', () => {
  it('dit « / mois » et « / an »', () => {
    assert.equal(periodiciteAbonnement(30), '/ mois');
    assert.equal(periodiciteAbonnement(365), '/ an');
  });

  it('ne dit rien quand le produit n’est pas un abonnement', () => {
    // Le suffixe est collé au prix : « 4 800 € / » serait pire que rien.
    assert.equal(periodiciteAbonnement(null), '');
  });

  it('retombe sur la durée pour une période inhabituelle', () => {
    assert.equal(periodiciteAbonnement(90), '/ 3 mois');
    assert.equal(periodiciteAbonnement(45), '/ 45 jours');
  });

  it('nomme le type sans jamais se tromper de rythme', () => {
    // Afficher « Abonnement mensuel » sur un produit annuel, ou l'inverse, est
    // une promesse de prix fausse d'un facteur douze.
    assert.equal(libelleAbonnement(30), 'Abonnement mensuel');
    assert.equal(libelleAbonnement(365), 'Abonnement annuel');
    assert.equal(libelleAbonnement(90), 'Abonnement');
    assert.equal(libelleAbonnement(null), 'Abonnement');
  });
});
