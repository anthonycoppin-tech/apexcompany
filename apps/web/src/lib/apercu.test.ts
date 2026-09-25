import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { verifierApercu } from './apercu.ts';

const basic = (s: string) => `Basic ${btoa(s)}`;

describe('verifierApercu', () => {
  it('sans variable, le site est libre — c’est la production', () => {
    assert.equal(verifierApercu(undefined, '/', null).acces, 'libre');
    assert.equal(verifierApercu('', '/', null).acces, 'libre');
  });

  it('avec variable, une page demande les identifiants', () => {
    assert.equal(verifierApercu('apex:secret', '/', null).acces, 'refuse');
    assert.equal(verifierApercu('apex:secret', '/', basic('apex:faux')).acces, 'refuse');
    assert.equal(verifierApercu('apex:secret', '/', basic('apex:secret')).acces, 'autorise');
  });

  it('les webhooks et les tâches planifiées restent joignables', () => {
    assert.equal(verifierApercu('apex:secret', '/api/whop', null).acces, 'libre');
    assert.equal(verifierApercu('apex:secret', '/api/cron/revocation', null).acces, 'libre');
  });

  it('un en-tête malformé est refusé, pas une erreur', () => {
    assert.equal(verifierApercu('apex:secret', '/', 'Basic %%%').acces, 'refuse');
    assert.equal(verifierApercu('apex:secret', '/', 'Bearer x').acces, 'refuse');
  });
});
