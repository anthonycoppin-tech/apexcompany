import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { memeNom, roleDuProduit } from './noms-de-role.ts';

/**
 * Cette fonction décide si un rôle existant est réutilisé ou si un second est
 * créé. Se tromper ne lève aucune erreur : ça laisse deux rôles pour un même
 * produit, dont un seul ouvre l'accès.
 */
describe('le rôle attendu pour un produit', () => {
  it('prend le titre du produit par défaut', () => {
    assert.equal(roleDuProduit('palace-1', 'PALACE 1'), 'PALACE 1');
    assert.equal(roleDuProduit('apex-black', 'APEX BLACK'), 'APEX BLACK');
  });

  it('réunit APEX PRIME mensuel et annuel sous un seul rôle', () => {
    assert.equal(roleDuProduit('apex-prime', 'APEX PRIME'), 'APEX PRIME');
    assert.equal(roleDuProduit('apex-prime-annuel', 'APEX PRIME — annuel'), 'APEX PRIME');
  });
});

describe('correspondance des noms de rôle', () => {
  it('reconnaît un nom écrit avec des underscores', () => {
    // L'écriture courante sur Discord, où l'espace se tape mal.
    assert.equal(memeNom('APEX_PRIME', 'APEX PRIME'), true);
    assert.equal(memeNom('PALACE_1', 'PALACE 1'), true);
    assert.equal(memeNom('APEX_PARTNER_6_MOIS_LANCEMENT', 'APEX PARTNER — 6 mois lancement'), true);
    assert.equal(memeNom('MATRIX_3.0', 'MATRIX 3.0'), true);
  });

  it('reconnaît le même nom à la forme du tiret près', () => {
    assert.equal(
      memeNom('APEX PARTNER — 6 mois lancement', 'APEX PARTNER - 6 mois lancement'),
      true,
    );
    assert.equal(memeNom('APEX PARTNER – 6 mois', 'APEX PARTNER — 6 mois'), true);
  });

  it('ignore la casse et les espaces en trop', () => {
    assert.equal(memeNom('apex prime', 'APEX PRIME'), true);
    assert.equal(memeNom('  PALACE 1 ', 'PALACE 1'), true);
    assert.equal(memeNom('PALACE  1', 'PALACE 1'), true);
  });

  it('ne confond pas deux produits voisins', () => {
    assert.equal(memeNom('PALACE 1', 'PALACE 2'), false);
    assert.equal(memeNom('APEX PARTNER', 'APEX PARTNER — 6 mois lancement'), false);
    assert.equal(memeNom('APEX PRIME', 'APEX PRIME — annuel'), false);
  });
});
