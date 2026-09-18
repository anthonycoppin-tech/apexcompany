import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { codeSource, lienQualification } from './source.ts';

describe('source des réseaux', () => {
  it('transmet au formulaire le réseau de la page d’arrivée', () => {
    assert.equal(lienQualification('?src=ig'), '/qualification?src=ig');
    assert.equal(lienQualification('?utm_medium=bio&src=YT'), '/qualification?src=yt');
    assert.equal(lienQualification(''), '/qualification');
  });

  it('ne recopie jamais un code inconnu dans un lien', () => {
    assert.equal(lienQualification('?src=<script>'), '/qualification');
    assert.equal(codeSource('?src=inconnu'), null);
  });

  it('ne prend pas une propriété héritée pour une source', () => {
    // `SOURCES['toString']` existe sur tout objet : sans `hasOwn`, il serait
    // passé pour une source et aurait fait échouer l'écriture du lead.
    assert.equal(codeSource('?src=toString'), null);
    assert.equal(codeSource('?src=constructor'), null);
  });
});
