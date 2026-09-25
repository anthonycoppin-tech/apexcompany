'use server';

import { creerCompteEtSession } from '@/lib/auth/creation-compte';
import { echoue, reussi, type EtatAction } from '@/lib/messages/types';
import { CHAMP_PIEGE } from '@/lib/qualification/anti-spam';
import { VERSION_CONSENTEMENT } from '@/lib/qualification/questionnaire';
import { codeSource, SOURCES } from '@/lib/qualification/source';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Créer un compte sans passer par le formulaire de qualification.
 *
 * Demandé par le client le 25 septembre 2026, après la présentation : tout le
 * monde ne veut pas faire le point avant d'entrer, et le compte est la porte du
 * Discord en `invité`. L'action ne fait que créer le compte ; la liaison
 * Discord est lancée par le navigateur dans la foulée (`formulaire.tsx`), et le
 * rôle `invité` est empilé par `api/discord/callback`, comme pour tout le monde.
 *
 * Les garde-fous du formulaire de qualification valent ici à l'identique :
 * champ piège, session déjà ouverte refusée, consentement explicite, limite de
 * comptes par adresse (dans `creerCompteEtSession`), et **refus des mineurs** —
 * ici par une déclaration, puisqu'il n'y a pas de question sur l'âge.
 */
export async function inscrire(_precedent: EtatAction, donnees: FormData): Promise<EtatAction> {
  const lu = (champ: string) => (donnees.get(champ) ?? '').toString().trim();

  // Même réponse qu'un échec ordinaire : dire à un robot pourquoi, c'est lui
  // apprendre à contourner.
  if (lu(CHAMP_PIEGE)) {
    await createServiceRoleClient()
      .from('automation_logs')
      .insert({
        declencheur: 'inscription.piege',
        entite_type: 'leads',
        statut: 'ignore',
        details: { raison: 'Champ piège rempli' },
      });
    return echoue('La création du compte a échoué. Réessayez dans un instant.');
  }

  const prenom = lu('prenom');
  const email = lu('email').toLowerCase();
  const telephone = lu('telephone') || null;

  if (!prenom) return echoue('Votre prénom est nécessaire.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return echoue('Cette adresse email n’est pas valide.');
  }
  if (lu('majeur') !== 'on') {
    return echoue('Nos programmes ne sont pas ouverts aux moins de 18 ans.');
  }
  if (lu('consentement') !== 'on') {
    return echoue('Merci d’accepter la politique de confidentialité pour continuer.');
  }

  // `creerCompteEtSession()` remplace le cookie de session : une personne déjà
  // connectée se retrouverait dans la peau du compte qu'elle vient de créer.
  const { data: session } = await (await createClient()).auth.getUser();
  if (session.user) {
    return echoue('Vous êtes déjà connecté. Déconnectez-vous d’abord pour créer un autre compte.');
  }

  const creation = await creerCompteEtSession({
    email,
    prenom,
    telephone,
    versionConsentement: VERSION_CONSENTEMENT,
  });

  if (!creation.ok) return echoue(creation.erreur);

  // Une fiche, comme pour l'acheteur direct : sans elle, la personne serait
  // invisible du CRM, et aucun formateur ne pourrait lui adresser de
  // proposition — une proposition part toujours d'une fiche. Le réseau
  // d'origine suit le même chemin que pour le formulaire.
  const src = codeSource(`src=${encodeURIComponent(lu('src'))}`);
  const admin = createServiceRoleClient();
  const { data: lead } = await admin
    .from('leads')
    .insert({
      user_id: creation.userId,
      email,
      prenom,
      telephone,
      source: src ? SOURCES[src] : 'direct',
      statut: 'nouveau',
      utm: src ? { src } : {},
    })
    .select('id')
    .single();

  if (lead) {
    await admin.from('lead_events').insert({
      lead_id: lead.id,
      type: 'inscription_directe',
      payload: {},
    });
  }

  return reussi('Votre compte est créé.');
}
