import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { peutReprendre, TENTATIVES_MAX } from './registre.ts';
import {
  demandeAttention,
  raisonDuRebond,
  remplace,
  statutDeLEvenement,
  type StatutEvenement,
} from './rebonds.ts';
import { entetesDe, signatureValide, signerPourTest } from './signature-resend.ts';

describe('les événements qu’on traite', () => {
  it('reconnaît les trois qui apprennent quelque chose', () => {
    assert.equal(statutDeLEvenement('email.delivered'), 'livre');
    assert.equal(statutDeLEvenement('email.bounced'), 'rebond');
    assert.equal(statutDeLEvenement('email.complained'), 'plainte');
  });

  it('ignore ceux que le registre connaît déjà ou qui n’appellent aucune action', () => {
    for (const type of [
      'email.sent',
      'email.opened',
      'email.clicked',
      'email.delivery_delayed',
      'contact.created',
      '',
    ]) {
      assert.equal(statutDeLEvenement(type), null, type);
    }
  });

  it('ne traite pas une propriété héritée comme un événement', () => {
    assert.equal(statutDeLEvenement('constructor'), null);
    assert.equal(statutDeLEvenement('toString'), null);
  });
});

describe('l’ordre d’arrivée ne décide pas', () => {
  it('avance depuis les états que la tâche peut encore reprendre', () => {
    for (const depart of ['en_cours', 'echec']) {
      for (const arrivee of ['livre', 'rebond', 'plainte'] as StatutEvenement[]) {
        assert.equal(remplace(depart, arrivee), true, `${depart} → ${arrivee}`);
      }
    }
  });

  it('avance de « accepté par Resend » vers « reçu »', () => {
    assert.equal(remplace('envoye', 'livre'), true);
  });

  it('n’efface jamais un rebond ni une plainte par une livraison tardive', () => {
    // Le cas qui motive le rang : Resend ne garantit pas l'ordre, et une
    // plainte arrive forcément après la livraison qui l'a provoquée.
    assert.equal(remplace('rebond', 'livre'), false);
    assert.equal(remplace('plainte', 'livre'), false);
    assert.equal(remplace('plainte', 'rebond'), false);
  });

  it('laisse une plainte l’emporter sur un rebond', () => {
    assert.equal(remplace('rebond', 'plainte'), true);
  });

  it('ne réécrit rien quand le même événement est rejoué', () => {
    assert.equal(remplace('livre', 'livre'), false);
    assert.equal(remplace('rebond', 'rebond'), false);
    assert.equal(remplace('plainte', 'plainte'), false);
  });

  it('ne touche pas à un statut qu’il ne connaît pas', () => {
    // Une version plus récente du schéma : ne rien écrire est le seul choix
    // sûr, puisqu'on ignore si ce qu'on remplacerait est plus grave.
    assert.equal(remplace('quarantaine', 'livre'), false);
    assert.equal(remplace('', 'rebond'), false);
  });
});

describe('un rebond ne se retente pas', () => {
  const ligne = (statut: string) => ({
    statut,
    tentatives: 1,
    updated_at: new Date(0).toISOString(),
  });

  it('la tâche ne reprend ni un rebond, ni une plainte, ni un email reçu', () => {
    // La garantie qui compte : relancer trois fois une adresse morte abîme la
    // réputation du domaine, donc la délivrabilité de tous les autres emails.
    for (const statut of ['rebond', 'plainte', 'livre', 'envoye']) {
      assert.equal(peutReprendre(ligne(statut)), false, statut);
    }
  });

  it('elle reprend toujours un échec d’envoi, qui est autre chose', () => {
    assert.equal(peutReprendre(ligne('echec')), true);
    assert.equal(
      peutReprendre({ ...ligne('echec'), tentatives: TENTATIVES_MAX }),
      false,
      'sauf une fois les tentatives épuisées',
    );
  });
});

describe('le motif affiché en face de l’adresse', () => {
  it('distingue le définitif du temporaire, qui n’appellent pas la même suite', () => {
    assert.match(
      raisonDuRebond('rebond', { type: 'Permanent', message: 'The email does not exist' }) ?? '',
      /Permanent/,
    );
    assert.match(raisonDuRebond('rebond', { type: 'Transient' }) ?? '', /Transient/);
  });

  it('reste lisible quand Resend ne transmet aucun motif', () => {
    assert.equal(raisonDuRebond('rebond', undefined), 'Rebond, sans motif transmis');
    assert.equal(raisonDuRebond('rebond', { message: '  ' }), 'Rebond, sans motif transmis');
  });

  it('dit ce qu’est une plainte, et n’invente rien pour une livraison', () => {
    assert.match(raisonDuRebond('plainte', undefined) ?? '', /indésirable/);
    assert.equal(raisonDuRebond('livre', undefined), null);
  });

  it('ne réclame une action humaine que pour un rebond ou une plainte', () => {
    assert.equal(demandeAttention('livre'), false);
    assert.equal(demandeAttention('rebond'), true);
    assert.equal(demandeAttention('plainte'), true);
  });
});

describe('la signature du webhook', () => {
  const secret = `whsec_${Buffer.from('un secret de test').toString('base64')}`;
  const corps = JSON.stringify({ type: 'email.bounced', data: { email_id: 'abc' } });
  const id = 'msg_2abc';
  const maintenant = 1_700_000_000_000;
  const horodatage = String(Math.floor(maintenant / 1000));

  const entetes = (surcharge: Record<string, string | null> = {}) => ({
    id,
    horodatage,
    signature: `v1,${signerPourTest(corps, id, horodatage, secret)}`,
    ...surcharge,
  });

  it('accepte une signature correcte', () => {
    assert.equal(signatureValide(corps, entetes(), secret, maintenant), true);
  });

  it('refuse un corps modifié après signature', () => {
    const falsifie = JSON.stringify({ type: 'email.bounced', data: { email_id: 'autre' } });
    assert.equal(signatureValide(falsifie, entetes(), secret, maintenant), false);
  });

  it('refuse une signature signée avec un autre secret', () => {
    const autre = `whsec_${Buffer.from('pas le bon').toString('base64')}`;
    const forgee = entetes({ signature: `v1,${signerPourTest(corps, id, horodatage, autre)}` });
    assert.equal(signatureValide(corps, forgee, secret, maintenant), false);
  });

  it('refuse une capture rejouée plus tard', () => {
    // L'horodatage entre dans la signature : sans la tolérance, une requête
    // valide capturée une fois resterait rejouable indéfiniment.
    const dixMinutes = maintenant + 10 * 60 * 1000;
    assert.equal(signatureValide(corps, entetes(), secret, dixMinutes), false);
  });

  it('refuse quand un en-tête manque, ou que l’horodatage n’est pas un nombre', () => {
    assert.equal(signatureValide(corps, entetes({ signature: null }), secret, maintenant), false);
    assert.equal(signatureValide(corps, entetes({ id: null }), secret, maintenant), false);
    assert.equal(
      signatureValide(corps, { ...entetes(), horodatage: 'hier' }, secret, maintenant),
      false,
    );
  });

  it('refuse une signature d’une autre version, et accepte une liste qui contient la bonne', () => {
    const bonne = signerPourTest(corps, id, horodatage, secret);
    assert.equal(
      signatureValide(corps, entetes({ signature: `v2,${bonne}` }), secret, maintenant),
      false,
    );
    assert.equal(
      signatureValide(corps, entetes({ signature: `v1,inutile v1,${bonne}` }), secret, maintenant),
      true,
      'Svix envoie plusieurs signatures pendant une rotation de secret',
    );
  });

  it('lit les en-têtes sous les deux noms que les relais emploient', () => {
    const svix = new Request('https://exemple.fr/api/resend', {
      method: 'POST',
      headers: { 'svix-id': id, 'svix-timestamp': horodatage, 'svix-signature': 'v1,x' },
    });
    const standard = new Request('https://exemple.fr/api/resend', {
      method: 'POST',
      headers: { 'webhook-id': id, 'webhook-timestamp': horodatage, 'webhook-signature': 'v1,x' },
    });

    assert.deepEqual(entetesDe(svix), { id, horodatage, signature: 'v1,x' });
    assert.deepEqual(entetesDe(standard), { id, horodatage, signature: 'v1,x' });
  });
});
