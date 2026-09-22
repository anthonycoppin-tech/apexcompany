import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { retractationAccompagnement } from './retractation.ts';

const base = {
  typeProduit: 'accompagnement',
  montantCents: 90_000,
  payeLe: '2026-10-01',
  debut: '2026-10-01',
  fin: '2026-12-30', // 90 jours
};

describe('la rétractation d’un accompagnement', () => {
  it('reproduit l’exemple publié sur /remboursement', () => {
    const r = retractationAccompagnement({ ...base, aujourdhui: '2026-10-06' });
    assert.deepEqual(
      r && [r.joursEcoules, r.joursTotal, r.retenuCents, r.rembourseCents],
      [6, 90, 6_000, 84_000],
    );
  });

  it('compte le jour du paiement comme le premier', () => {
    const r = retractationAccompagnement({ ...base, aujourdhui: '2026-10-01' });
    assert.equal(r?.retenuCents, 1_000);
  });

  it('s’arrête après quatorze jours, pas avant', () => {
    assert.equal(
      retractationAccompagnement({ ...base, aujourdhui: '2026-10-15' })?.limite,
      '2026-10-15',
    );
    assert.equal(retractationAccompagnement({ ...base, aujourdhui: '2026-10-16' }), null);
  });

  it('ne s’applique ni à une formation ni à un abonnement', () => {
    for (const typeProduit of ['formation', 'abonnement']) {
      assert.equal(
        retractationAccompagnement({ ...base, typeProduit, aujourdhui: '2026-10-03' }),
        null,
      );
    }
  });

  it('rend des centimes entiers dont la somme est le prix payé', () => {
    const r = retractationAccompagnement({
      ...base,
      montantCents: 99_999,
      fin: '2026-10-31',
      aujourdhui: '2026-10-07',
    });
    assert.ok(r && Number.isInteger(r.retenuCents));
    assert.equal(r && r.retenuCents + r.rembourseCents, 99_999);
  });

  it('refuse des dates incohérentes plutôt que d’inventer un montant', () => {
    assert.equal(
      retractationAccompagnement({ ...base, fin: null, aujourdhui: '2026-10-03' }),
      null,
    );
    assert.equal(
      retractationAccompagnement({ ...base, fin: '2026-10-01', aujourdhui: '2026-10-01' }),
      null,
    );
  });
});
