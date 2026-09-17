import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import * as catalogue from './catalogue.ts';
import type { Preuve } from './preuves.ts';
import type { Message } from './types.ts';

/**
 * La propriété qui tient le système de messages, énoncée une fois pour toutes :
 * **un code dépendant sans preuve ne rend rien.**
 *
 * Rien ne la vérifiait. Elle se serait cassée en silence au prochain code
 * ajouté — un `return succes(...)` écrit avant le test de la preuve, et
 * `/espace?m=paiement-recu` redit « Paiement reçu » à qui n'a rien payé.
 *
 * **Le test ne fait confiance à personne pour se tenir à jour.** Les codes
 * dépendants et les fonctions qui prennent une preuve sont relevés dans le
 * source de `catalogue.ts`, pas recopiés ici : un code ajouté demain est
 * couvert sans qu'on y pense, et une fonction ajoutée sans être déclarée
 * ci-dessous fait échouer le test plutôt que de passer à travers.
 */

type Dependante = (code: string | undefined, preuve: Preuve<never>) => Message | null;

const DEPENDANTES: Record<string, Dependante> = {
  messageDiscord: catalogue.messageDiscord as Dependante,
  messagePaiement: catalogue.messagePaiement as Dependante,
  messageCompte: catalogue.messageCompte as Dependante,
};

const source = readFileSync(new URL('./catalogue.ts', import.meta.url), 'utf8');

const codesDependants = [...source.matchAll(/code === '([^']+)'/g)].map((m) => m[1]);
const fonctionsAPreuve = [...source.matchAll(/export function (\w+)\([^)]*Preuve</g)].map(
  (m) => m[1],
);

/**
 * Une preuve dont **chaque** champ est faux, y compris ceux qui n'existent pas
 * encore : un champ ajouté à une preuve demain est couvert d'office. La preuve
 * est fabriquée par un transtypage, ce que `preuves.ts` interdit au code du
 * site — c'est précisément ce qu'un test a le droit de faire.
 */
const preuveVide = new Proxy({}, { get: () => false }) as Preuve<never>;
const preuvePleine = new Proxy({}, { get: () => true }) as Preuve<never>;

const codesEssayes = [
  ...codesDependants,
  'paiement-annule',
  'discord-echec',
  'discord-annule',
  'inconnu',
  '',
  undefined,
];

describe('catalogue des messages', () => {
  it('relève bien des codes et des fonctions dans le source', () => {
    // Sans cette garde, une regex devenue fausse viderait les deux listes et
    // tous les tests ci-dessous passeraient sans rien vérifier.
    assert.ok(codesDependants.length >= 3, `codes dépendants relevés : ${codesDependants}`);
    assert.ok(fonctionsAPreuve.length >= 3, `fonctions à preuve relevées : ${fonctionsAPreuve}`);
  });

  it('déclare ici chaque fonction qui prend une preuve', () => {
    assert.deepEqual(
      [...fonctionsAPreuve].sort(),
      Object.keys(DEPENDANTES).sort(),
      'Une fonction de catalogue.ts prend une Preuve sans être couverte par ce test : ajoutez-la à DEPENDANTES.',
    );
  });

  it('ne range aucun code dépendant parmi les constantes', () => {
    for (const code of codesDependants) {
      assert.equal(
        catalogue.messageConstant(code),
        null,
        `« ${code} » est à la fois constant et dépendant : forgé, il s'afficherait sans preuve.`,
      );
    }
  });

  for (const [nom, fonction] of Object.entries(DEPENDANTES)) {
    describe(nom, () => {
      it('ne rend rien de plus qu’une constante quand la preuve manque', () => {
        for (const code of codesEssayes) {
          assert.deepEqual(
            fonction(code, preuveVide),
            catalogue.messageConstant(code),
            `${nom}(${JSON.stringify(code)}) affirme quelque chose sans preuve.`,
          );
        }
      });

      it('rend son message quand la preuve est là', () => {
        // L'inverse de la règle : une fonction qui ne rendrait jamais rien
        // passerait le test précédent sans rien démontrer.
        const rendus = codesDependants.filter((code) => {
          const message = fonction(code, preuvePleine);
          return message !== null && catalogue.messageConstant(code) === null;
        });
        assert.ok(rendus.length > 0, `${nom} ne rend aucun code dépendant, même prouvé.`);
      });
    });
  }

  it('n’affiche jamais le texte d’une erreur venue du fournisseur', () => {
    const texte = 'Something went wrong <script>';
    const message = catalogue.messageFournisseur('code_inconnu', texte);
    assert.ok(message, 'une erreur inconnue reste une erreur');
    assert.ok(!message.texte.includes(texte));
    assert.equal(catalogue.messageFournisseur(null, null), null);
  });

  it('vouvoie', () => {
    // Décision du 16 septembre 2026 : tout texte visible par un client se
    // vouvoie. Le catalogue est entièrement lu par des clients. Seuls les
    // pronoms sont repérés : un impératif (« Relie ») passe à travers.
    const textes = [...source.matchAll(/(?:succes|alerte|info)\(\s*'([^']*)'/g)].map((m) => m[1]);
    assert.ok(textes.length > 0);
    for (const texte of textes) {
      assert.doesNotMatch(
        texte,
        /\b(tu|te|toi|ton|ta|tes)\b|\bt’|-nous\b(?<!ez-nous)/i,
        `tutoiement dans « ${texte} »`,
      );
    }
  });
});
