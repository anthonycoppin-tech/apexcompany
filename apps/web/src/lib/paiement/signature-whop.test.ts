import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contenuSigne, signer, verifierSignature } from './signature-whop.ts';

const SECRET = 'ws_ZmFrZS1zZWNyZXQtcG91ci1sZXMtdGVzdHM';
const CORPS = '{"id":"evt_1","type":"payment.succeeded","data":{"id":"pay_1"}}';
const ID = 'msg_2abc';
const MAINTENANT = 1_790_000_000_000; // en millisecondes
const HORODATAGE = String(Math.floor(MAINTENANT / 1000));

type Modif = Partial<Record<'id' | 'horodatage' | 'signature', string | null>>;

const entetes = (modif: Modif = {}) => ({
  id: ID,
  horodatage: HORODATAGE,
  signature: `v1,${signer(SECRET, contenuSigne(ID, HORODATAGE, CORPS))}`,
  ...modif,
});

describe('la signature d’un webhook Whop', () => {
  it('accepte une signature juste', () => {
    assert.deepEqual(verifierSignature(SECRET, entetes(), CORPS, MAINTENANT), { valide: true });
  });

  it('accepte l’une de plusieurs signatures, le temps d’une rotation de secret', () => {
    const autre = signer('ws_autre', contenuSigne(ID, HORODATAGE, CORPS));
    const signature = `v1,${autre} ${entetes().signature}`;
    assert.deepEqual(verifierSignature(SECRET, entetes({ signature }), CORPS, MAINTENANT), {
      valide: true,
    });
  });

  it('refuse un corps modifié d’un seul caractère', () => {
    const falsifie = CORPS.replace('pay_1', 'pay_2');
    assert.deepEqual(verifierSignature(SECRET, entetes(), falsifie, MAINTENANT), {
      valide: false,
      raison: 'signature',
    });
  });

  it('refuse une signature produite avec un autre secret', () => {
    assert.deepEqual(verifierSignature('ws_intrus', entetes(), CORPS, MAINTENANT), {
      valide: false,
      raison: 'signature',
    });
  });

  it('signe l’identifiant et l’horodatage, pas seulement le corps', () => {
    // Si le contenu signé était le corps seul, rejouer le même appel sous un
    // autre identifiant passerait — et l'idempotence de `payment_events`
    // reposerait sur une valeur que n'importe qui pourrait changer.
    assert.deepEqual(verifierSignature(SECRET, entetes({ id: 'msg_autre' }), CORPS, MAINTENANT), {
      valide: false,
      raison: 'signature',
    });
  });

  it('refuse un appel trop vieux : c’est la seule protection contre le rejeu', () => {
    assert.deepEqual(verifierSignature(SECRET, entetes(), CORPS, MAINTENANT + 6 * 60 * 1000), {
      valide: false,
      raison: 'horodatage',
    });
  });

  it('refuse aussi un horodatage dans le futur', () => {
    assert.deepEqual(verifierSignature(SECRET, entetes(), CORPS, MAINTENANT - 6 * 60 * 1000), {
      valide: false,
      raison: 'horodatage',
    });
  });

  it('accepte le retard normal d’un renvoi, à quatre minutes', () => {
    assert.deepEqual(verifierSignature(SECRET, entetes(), CORPS, MAINTENANT + 4 * 60 * 1000), {
      valide: true,
    });
  });

  it('refuse un en-tête manquant sans tenter de deviner', () => {
    for (const manquant of ['id', 'horodatage', 'signature'] as const) {
      assert.deepEqual(verifierSignature(SECRET, entetes({ [manquant]: null }), CORPS, MAINTENANT), {
        valide: false,
        raison: 'en-tetes',
      });
    }
  });

  it('refuse un horodatage qui n’est pas un nombre', () => {
    assert.deepEqual(verifierSignature(SECRET, entetes({ horodatage: 'hier' }), CORPS, MAINTENANT), {
      valide: false,
      raison: 'horodatage',
    });
  });

  it('refuse une signature sans son préfixe de version', () => {
    const signature = signer(SECRET, contenuSigne(ID, HORODATAGE, CORPS));
    assert.deepEqual(verifierSignature(SECRET, entetes({ signature }), CORPS, MAINTENANT), {
      valide: false,
      raison: 'signature',
    });
  });
});
