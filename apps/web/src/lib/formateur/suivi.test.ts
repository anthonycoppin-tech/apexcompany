import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bornesDesJours } from '../format.ts';
import {
  JOUR_MS,
  dansLeBudget,
  depuis,
  detailEvenement,
  duree,
  joursRestants,
  libelleEvenement,
  mediane,
  numeroWhatsApp,
  pourcentage,
  scoreAppel,
} from './suivi.ts';

/**
 * Les petites règles qui décident de l'écran du formateur : qui appeler
 * d'abord, ce qui tient dans un budget, combien de jours il reste. Elles se
 * cassent sans bruit — un tri inversé ne lève aucune erreur, il fait juste
 * rappeler le mauvais prospect en premier.
 */

const MAINTENANT = Date.parse('2026-09-17T10:00:00Z');

describe('ordre d’appel des prospects', () => {
  const prospect = (
    budget: Parameters<typeof scoreAppel>[0]['tranche_budget'],
    delai: Parameters<typeof scoreAppel>[0]['delai_objectif'],
    ageJours: number,
  ) => ({
    tranche_budget: budget,
    delai_objectif: delai,
    created_at: new Date(MAINTENANT - ageJours * JOUR_MS).toISOString(),
  });

  it('fait passer le budget et l’urgence devant', () => {
    const riche = scoreAppel(prospect('plus_5000', 'immediat', 2), MAINTENANT);
    const modeste = scoreAppel(prospect('500_1000', 'trois_mois', 2), MAINTENANT);
    assert.ok(riche > modeste);
  });

  it('à profil égal, le plus récent d’abord', () => {
    const frais = scoreAppel(prospect('1000_2000', 'mois_prochain', 0), MAINTENANT);
    const ancien = scoreAppel(prospect('1000_2000', 'mois_prochain', 5), MAINTENANT);
    assert.ok(frais > ancien);
  });

  it('ne plante pas sur un formulaire incomplet', () => {
    assert.equal(typeof scoreAppel(prospect(null, null, 1), MAINTENANT), 'number');
  });
});

describe('budget déclaré', () => {
  it('compare au plafond de la tranche', () => {
    assert.equal(dansLeBudget(99_000, '500_1000'), true);
    assert.equal(dansLeBudget(100_000, '500_1000'), true);
    assert.equal(dansLeBudget(100_001, '500_1000'), false);
    assert.equal(dansLeBudget(10_000_000, 'plus_5000'), true);
  });

  it('ne tranche pas sans réponse', () => {
    assert.equal(dansLeBudget(100, null), null);
  });
});

describe('lien WhatsApp', () => {
  it('garde l’indicatif international', () => {
    assert.equal(numeroWhatsApp('+33 6 12 34 56 78'), '33612345678');
    assert.equal(numeroWhatsApp('0033612345678'), '33612345678');
  });

  it('ramène un mobile français à +33', () => {
    assert.equal(numeroWhatsApp('06 12 34 56 78'), '33612345678');
    assert.equal(numeroWhatsApp('07.12.34.56.78'), '33712345678');
  });

  it('ne devine pas un numéro sans indicatif qui n’est pas un mobile français', () => {
    assert.equal(numeroWhatsApp('01 23 45 67 89'), null);
    assert.equal(numeroWhatsApp('5551234'), null);
    assert.equal(numeroWhatsApp(null), null);
  });
});

describe('jours restants', () => {
  it('compte jusqu’au soir du dernier jour', () => {
    // Le 17 à 10 h, un accès qui finit le 17 a encore sa journée.
    assert.equal(joursRestants('2026-09-17', MAINTENANT), 1);
    assert.equal(joursRestants('2026-09-27', MAINTENANT), 11);
  });

  it('devient négatif une fois l’accès passé, et nul pour l’illimité', () => {
    assert.ok((joursRestants('2026-09-10', MAINTENANT) ?? 0) < 0);
    assert.equal(joursRestants(null, MAINTENANT), null);
  });
});

describe('durées et proportions', () => {
  it('dit « il y a » comme on le lit', () => {
    assert.equal(
      depuis(new Date(MAINTENANT - 30 * 60_000).toISOString(), MAINTENANT),
      'à l’instant',
    );
    assert.equal(
      depuis(new Date(MAINTENANT - 5 * 3_600_000).toISOString(), MAINTENANT),
      'il y a 5 h',
    );
    assert.equal(
      depuis(new Date(MAINTENANT - 3 * JOUR_MS).toISOString(), MAINTENANT),
      'il y a 3 j',
    );
    assert.equal(depuis(new Date(MAINTENANT + JOUR_MS).toISOString(), MAINTENANT), 'à venir');
    assert.equal(depuis(null, MAINTENANT), '—');
  });

  it('prend la médiane, pas la moyenne', () => {
    assert.equal(mediane([1, 100, 3]), 3);
    assert.equal(mediane([1, 2, 3, 4]), 2.5);
    assert.equal(mediane([]), null);
  });

  it('arrondit les durées à l’unité lisible', () => {
    assert.equal(duree(90_000), '2 min');
    assert.equal(duree(5 * 3_600_000), '5 h');
    assert.equal(duree(3 * JOUR_MS), '3 j');
    assert.equal(duree(null), '—');
  });

  it('ne divise jamais par zéro', () => {
    assert.equal(pourcentage(1, 3), '33 %');
    assert.equal(pourcentage(0, 0), '—');
  });
});

describe('historique d’un prospect', () => {
  it('nomme les événements', () => {
    assert.equal(libelleEvenement('formulaire_soumis', {}), 'A rempli le formulaire');
    assert.equal(
      libelleEvenement('echange', {
        canal: 'appel',
        statut_avant: 'nouveau',
        statut_apres: 'perdu',
        motif: 'budget',
      }),
      'Appel · marqué perdu (Budget insuffisant)',
    );
    assert.equal(
      libelleEvenement('formateur_affecte', { formation: 'Accélérateur', formateur_id: 'x' }),
      'Formateur affecté pour « Accélérateur »',
    );
    assert.equal(
      libelleEvenement('formateur_affecte', { formateur_id: null }),
      'Affectation retirée',
    );
    assert.equal(libelleEvenement('cal.BOOKING_CREATED', {}), 'A réservé son audit');
  });

  it('résume une proposition sans montrer le payload brut', () => {
    // Intl sépare les milliers et l'euro par des espaces insécables, dont la
    // forme varie d'une version d'ICU à l'autre.
    const espaces = (t: string | null) => t?.replace(/[\u00a0\u202f]/g, ' ');
    assert.equal(
      espaces(
        detailEvenement('proposition_emise', {
          montant_cents: 200_000,
          prix_catalogue_cents: 249_000,
          remise_cents: 49_000,
          expire_le: '2026-09-22T10:00:00Z',
        }),
      ),
      '2 000,00 € · remise de 490,00 € sur 2 490,00 € · valable jusqu’au 22/09/2026',
    );
    assert.equal(detailEvenement('formulaire_soumis', { blocage: 'gestion_risque' }), null);
  });
});

describe('bornes d’une période à Paris', () => {
  it('commence à minuit heure de Paris, été comme hiver', () => {
    // Heure d'été : Paris = UTC+2.
    assert.deepEqual(bornesDesJours('2026-09-01', '2026-09-30'), {
      debut: '2026-08-31T22:00:00.000Z',
      fin: '2026-09-30T22:00:00.000Z',
    });
    // Heure d'hiver : Paris = UTC+1.
    assert.deepEqual(bornesDesJours('2026-12-01', '2026-12-01'), {
      debut: '2026-11-30T23:00:00.000Z',
      fin: '2026-12-01T23:00:00.000Z',
    });
  });

  it('traverse le changement d’heure d’octobre', () => {
    const { debut, fin } = bornesDesJours('2026-10-25', '2026-10-25');
    assert.equal(debut, '2026-10-24T22:00:00.000Z');
    assert.equal(fin, '2026-10-25T23:00:00.000Z');
  });
});
