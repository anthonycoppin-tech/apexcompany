import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decisionEncaissement, type PaiementWhop } from './aiguillage-whop.ts';

const METADONNEES = {
  user_id: '11111111-1111-1111-1111-111111111111',
  formation_id: 'a0000000-0000-0000-0000-000000000001',
  commande: 'ref-de-commande',
};

/**
 * Compare seulement les champs cités.
 *
 * `assert.partialDeepStrictEqual` ferait la même chose, mais il n'est pas
 * déclaré par la version de @types/node installée : les tests passeraient et le
 * typecheck non. Six lignes valent mieux qu'une dépendance sur une API que
 * l'outillage ne connaît pas encore.
 */
function partiel(obtenu: object, attendu: Record<string, unknown>) {
  const o = obtenu as Record<string, unknown>;
  assert.deepEqual(Object.fromEntries(Object.keys(attendu).map((cle) => [cle, o[cle]])), attendu);
}

const paiement = (modif: Partial<PaiementWhop> = {}): PaiementWhop => ({
  id: 'pay_1',
  total: '290.00',
  currency: 'eur',
  metadata: METADONNEES,
  ...modif,
});

describe('l’aiguillage d’un encaissement Whop', () => {
  it('reconnaît un premier paiement', () => {
    const d = decisionEncaissement(paiement(), { adhesionConnue: false });
    assert.equal(d.type, 'premier-paiement');
    partiel(d, {
      userId: METADONNEES.user_id,
      formationId: METADONNEES.formation_id,
      commande: METADONNEES.commande,
      montantCents: 29000,
      devise: 'EUR',
      referencePaiement: 'pay_1',
    });
  });

  it('reconnaît un renouvellement à l’adhésion déjà connue', () => {
    // Whop envoie le MÊME événement pour les deux. Le tri se fait sur l'état de
    // la base, jamais sur une chaîne dont la documentation ne donne pas les
    // valeurs.
    const d = decisionEncaissement(paiement({ membership_id: 'mem_1' }), {
      adhesionConnue: true,
    });
    assert.equal(d.type, 'renouvellement');
    partiel(d, { adhesion: 'mem_1', montantCents: 29000 });
  });

  it('traite comme un premier paiement une adhésion encore inconnue', () => {
    // Le premier prélèvement d'un abonnement porte déjà son adhésion : c'est
    // `traiter_paiement()` qui la crée. La compter comme un renouvellement
    // chercherait un abonnement qui n'existe pas encore.
    const d = decisionEncaissement(paiement({ membership_id: 'mem_1' }), {
      adhesionConnue: false,
    });
    assert.equal(d.type, 'premier-paiement');
    partiel(d, { adhesion: 'mem_1' });
  });

  it('envoie au rattrapage un paiement sans métadonnées', () => {
    // Les seize liens diffusés avant que le site ne sache ouvrir un paiement.
    const d = decisionEncaissement(paiement({ metadata: undefined }), {
      adhesionConnue: false,
    });
    assert.deepEqual(d, { type: 'rattrapage', raison: 'Métadonnées absentes' });
  });

  it('exige les trois métadonnées, pas deux', () => {
    // Sans `commande`, `traiter_paiement()` ne retrouve pas la commande déposée
    // en attente : il en crée une seconde, et la première reste « en attente »
    // pour toujours.
    for (const manquante of ['user_id', 'formation_id', 'commande'] as const) {
      const metadata = { ...METADONNEES, [manquante]: '' };
      const d = decisionEncaissement(paiement({ metadata }), { adhesionConnue: false });
      assert.equal(d.type, 'rattrapage', `devrait refuser sans ${manquante}`);
    }
  });

  it('envoie au rattrapage un montant illisible plutôt que d’inventer un zéro', () => {
    const d = decisionEncaissement(paiement({ total: 'gratuit' }), { adhesionConnue: false });
    assert.deepEqual(d, { type: 'rattrapage', raison: 'Montant illisible' });
  });

  it('refuse le montant illisible avant même de regarder l’adhésion', () => {
    // Un renouvellement dont on ne sait pas lire le montant repousserait la
    // date d'accès en encaissant on ne sait quoi.
    const d = decisionEncaissement(paiement({ total: null, membership_id: 'mem_1' }), {
      adhesionConnue: true,
    });
    assert.equal(d.type, 'rattrapage');
  });

  it('remonte la TVA et le pays quand Whop les rapporte', () => {
    const d = decisionEncaissement(
      paiement({ tax_amount: '2.33', billing_address: { country: 'ae' } }),
      { adhesionConnue: false },
    );
    partiel(d, { tvaCents: 233, paysClient: 'AE' });
  });

  it('laisse la TVA à null quand elle n’est pas rapportée — jamais un zéro', () => {
    const d = decisionEncaissement(paiement(), { adhesionConnue: false });
    partiel(d, { tvaCents: null, paysClient: null });
  });

  it('remonte la proposition quand elle est là, et rien quand elle ne l’est pas', () => {
    const avec = decisionEncaissement(
      paiement({ metadata: { ...METADONNEES, proposition_id: 'prop_1' } }),
      { adhesionConnue: false },
    );
    partiel(avec, { propositionId: 'prop_1' });

    const sans = decisionEncaissement(paiement(), { adhesionConnue: false });
    partiel(sans, { propositionId: null });
  });

  it('retombe sur la référence de commande quand Whop ne donne pas d’identifiant', () => {
    const d = decisionEncaissement(paiement({ id: undefined }), { adhesionConnue: false });
    partiel(d, { referencePaiement: METADONNEES.commande });
  });
});
