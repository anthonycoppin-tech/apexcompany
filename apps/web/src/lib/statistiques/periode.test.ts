import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lirePeriode } from './periode.ts';

// Le 15 octobre 2026 à 10 h, heure de Paris (UTC+2).
const MAINTENANT = Date.parse('2026-10-15T08:00:00Z');

describe('lirePeriode', () => {
  it('une journée va de minuit à minuit, heure de Paris', () => {
    const p = lirePeriode({ jour: '2026-10-15' }, '30', MAINTENANT);
    assert.equal(p.valeur, 'jour');
    assert.equal(p.libelle, 'Aujourd’hui');
    // 0 h 30 à Paris le 15 est encore le 14 en UTC : il en fait partie.
    assert.ok(p.dans('2026-10-14T22:30:00Z'));
    assert.ok(p.dans('2026-10-15T21:59:00Z'));
    // Minuit le 16 à Paris n'en fait plus partie.
    assert.ok(!p.dans('2026-10-15T22:00:00Z'));
    assert.ok(!p.dans('2026-10-14T21:59:00Z'));
  });

  it('periode=jour vaut aujourd’hui', () => {
    const p = lirePeriode({ periode: 'jour' }, '30', MAINTENANT);
    assert.equal(p.jour, '2026-10-15');
  });

  it('une date passée se nomme en toutes lettres', () => {
    const p = lirePeriode({ jour: '2026-10-01' }, '30', MAINTENANT);
    assert.match(p.libelle, /1 octobre 2026/);
  });

  it('une date illisible retombe sur la période par défaut', () => {
    const p = lirePeriode({ jour: '15/10/2026' }, '30', MAINTENANT);
    assert.equal(p.valeur, '30');
    assert.equal(p.jour, null);
  });

  it('une période glissante s’arrête à maintenant', () => {
    const p = lirePeriode({ periode: '7' }, '30', MAINTENANT);
    assert.ok(p.dans('2026-10-09T08:00:00Z'));
    assert.ok(!p.dans('2026-10-08T07:59:00Z'));
    assert.ok(!p.dans('2026-10-15T08:00:01Z'));
  });
});
