import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { rappelRetractation } from '../email/modeles.ts';
import {
  acceptationManquante,
  CHAMP_CGV,
  CHAMP_DEMARRAGE,
  texteDemarrage,
  versionAcceptation,
} from './acceptation.ts';

/**
 * La règle de l'article 8 des CGV, gardée en trois endroits qui doivent dire la
 * même chose : la case cochée avant de payer, la version enregistrée en base,
 * et l'email de confirmation. Une formation est un contenu numérique, dont la
 * rétractation s'éteint à l'accès, comme pour un abonnement (22 septembre) ;
 * l'accompagnement est un service, qui se quitte au prorata. Si l'un des trois change de camp seul, la preuve ne prouve plus ce
 * que le client a lu.
 */
const cases = (cgv: boolean, demarrage: boolean) => {
  const f = new FormData();
  if (cgv) f.set(CHAMP_CGV, 'on');
  if (demarrage) f.set(CHAMP_DEMARRAGE, 'on');
  return f;
};

describe('les cases avant paiement', () => {
  it('laisse passer quand les deux sont cochées', () => {
    assert.equal(acceptationManquante(cases(true, true)), null);
  });

  it('refuse chacune des deux absences, séparément', () => {
    assert.match(acceptationManquante(cases(false, true)) ?? '', /conditions générales/);
    assert.match(acceptationManquante(cases(true, false)) ?? '', /commence immédiatement/);
    assert.notEqual(acceptationManquante(cases(false, false)), null);
  });

  it('refuse une valeur autre que celle d’une case cochée', () => {
    const f = new FormData();
    f.set(CHAMP_CGV, 'true');
    f.set(CHAMP_DEMARRAGE, 'on');
    assert.notEqual(acceptationManquante(f), null);
  });
});

describe('la règle de rétractation, par type de produit', () => {
  it('formation et abonnement renoncent, l’accompagnement garde le prorata — partout', () => {
    for (const type of ['formation', 'abonnement'] as const) {
      assert.match(texteDemarrage(type), /perdre mon droit de rétractation/);
      assert.match(versionAcceptation(type), /renonciation$/);
      assert.match(rappelRetractation(type), /perdre ainsi votre droit de rétractation/);
    }

    assert.doesNotMatch(texteDemarrage('accompagnement'), /perdre/);
    assert.match(texteDemarrage('accompagnement'), /reste due/);
    assert.match(versionAcceptation('accompagnement'), /prorata$/);
    assert.match(rappelRetractation('accompagnement'), /pouvez encore vous rétracter/);
  });

  it('la version enregistrée date les textes acceptés', () => {
    assert.match(versionAcceptation('abonnement'), /^cgv\+avertissement:\d{4}-\d{2}-\d{2};/);
  });
});
