import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cellule, date, montant, versCsv } from './csv.ts';

describe('export CSV', () => {
  it('protège les séparateurs, les guillemets et les sauts de ligne', () => {
    assert.equal(cellule('simple'), 'simple');
    assert.equal(cellule('a;b'), '"a;b"');
    assert.equal(cellule('il a dit "oui"'), '"il a dit ""oui"""');
    assert.equal(cellule('ligne 1\nligne 2'), '"ligne 1\nligne 2"');
    assert.equal(cellule(null), '');
    assert.equal(cellule(undefined), '');
  });

  it('neutralise une cellule qui serait exécutée comme une formule', () => {
    // Un prospect peut saisir n'importe quoi dans son nom : ouvert dans un
    // tableur, ceci s'exécuterait sur le poste du comptable.
    assert.equal(cellule('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
    assert.equal(cellule('@SUM(A1)'), "'@SUM(A1)");
    assert.equal(cellule('-2+3'), "'-2+3");
  });

  it('laisse intacts les montants négatifs et les téléphones', () => {
    assert.equal(cellule('-10,00'), '-10,00');
    assert.equal(cellule('+33600000001'), '+33600000001');
    assert.equal(cellule('+33 6 00 00 00 01'), '+33 6 00 00 00 01');
  });

  it('écrit les montants en euros, virgule décimale', () => {
    assert.equal(montant(249000), '2490,00');
    assert.equal(montant(4905), '49,05');
    assert.equal(montant(0), '0,00');
    assert.equal(montant(null), '');
  });

  it('écrit les dates au format français, sans décaler une date seule', () => {
    assert.equal(date('2026-09-01'), '01/09/2026');
    // 23 h 30 UTC le 31 août, c'est déjà le 1er septembre à Paris.
    assert.equal(date('2026-08-31T23:30:00Z'), '01/09/2026');
    assert.equal(date(null), '');
  });

  it('produit un fichier qu’Excel ouvre correctement', () => {
    const csv = versCsv(['Nom', 'Montant'], [['Chloé', montant(100)]]);
    assert.ok(csv.startsWith('﻿'), 'sans BOM, Excel casse les accents');
    assert.equal(csv, '﻿Nom;Montant\r\nChloé;1,00\r\n');
  });
});
