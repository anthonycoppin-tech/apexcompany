'use server';

import { redirect } from 'next/navigation';

import type { Database } from '@apex/db';

import { evaluerEligibilite } from '@/lib/qualification/eligibilite';
import {
  CHAMPS_ATTENDUS,
  ECRANS,
  MOINS_18,
  VERSION_CONSENTEMENT,
} from '@/lib/qualification/questionnaire';
import { creerCompteEtSession } from '@/lib/auth/creation-compte';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

type LeadSource = Database['public']['Enums']['lead_source'];

export type EtatFormulaire = { readonly erreur: string | null };

/** `?src=ig` sur le lien mis en avant sur les réseaux → valeur d'énumération. */
const SOURCES: Readonly<Record<string, LeadSource>> = {
  ig: 'instagram',
  instagram: 'instagram',
  yt: 'youtube',
  youtube: 'youtube',
  tt: 'tiktok',
  tiktok: 'tiktok',
  sc: 'snapchat',
  snapchat: 'snapchat',
  parrainage: 'parrainage',
};

/**
 * Soumission du formulaire de qualification — la porte d'entrée du tunnel.
 *
 * Cette action est le seul endroit du site qui crée un compte. Elle s'exécute
 * pour un visiteur **anonyme** : il n'y a aucune session pour porter la RLS au
 * moment où le lead s'écrit, d'où le client `service_role`. C'est le troisième
 * usage légitime de cette clé, avec les webhooks et le worker Discord, et pour
 * la même raison — pas de session utilisateur à ce point du parcours.
 *
 * « Anonyme » est désormais **vérifié**, pas supposé : voir le garde-fou après
 * la validation de l'email. Une session déjà ouverte serait écrasée par celle
 * que cette action installe.
 *
 * L'ordre des écritures n'est pas indifférent :
 *
 * 1. le compte, parce que `leads.user_id` en dépend et parce que c'est lui qui
 *    permettra à la RLS de protéger la proposition, plus tard, sans jeton signé ;
 * 2. le lead, projection triable des réponses ;
 * 3. `lead_events`, qui reçoit la soumission **complète** en jsonb — l'original,
 *    lisible même le jour où les questions changent ;
 * 4. le consentement, avec la version du texte : sans elle on ne peut pas
 *    prouver à quoi la personne a consenti le jour où elle le demande ;
 * 5. la session, pour que la personne enchaîne connectée sur son rendez-vous.
 *
 * Le rôle Discord `invité` ne s'empile PAS ici — voir le commentaire en fin de
 * fonction : il n'y a pas encore d'identifiant Discord à qui l'accorder.
 */
export async function soumettreQualification(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const lu = (champ: string) => (donnees.get(champ) ?? '').toString().trim();

  // ── Refus dur des mineurs ────────────────────────────────────────────────
  // Le composant arrête déjà le parcours sur cet écran. On revérifie ici parce
  // qu'une action serveur est une API publique : elle ne peut pas faire
  // confiance à l'écran qui l'appelle. Aucune écriture n'a encore eu lieu.
  if (lu('tranche_age') === MOINS_18) {
    return { erreur: 'Nos accompagnements ne sont pas ouverts aux moins de 18 ans.' };
  }

  // ── Validation contre le questionnaire ───────────────────────────────────
  for (const ecran of ECRANS) {
    for (const question of ecran.questions) {
      const valeur = lu(question.champ);

      if (!valeur) {
        return { erreur: `Une réponse manque : « ${question.libelle} »` };
      }

      if (question.type === 'choix' && !question.options.some((o) => o.valeur === valeur)) {
        return { erreur: `Réponse invalide pour « ${question.libelle} »` };
      }
    }
  }

  const email = lu('email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { erreur: "Cette adresse email n'est pas valide." };
  }

  // Déjà connecté ? On s'arrête ici.
  //
  // `creerCompteEtSession()` finit par un `verifyOtp`, qui **remplace le cookie
  // de session** : une personne déjà connectée qui remplit ce formulaire avec
  // une autre adresse se retrouverait silencieusement dans la peau du compte
  // qu'elle vient de créer. Sur un compte de l'équipe, on y perdrait aussi son
  // accès au back-office, et le CRM y gagnerait un prospect fictif.
  //
  // Le header masque déjà « Faire le point » une fois la session ouverte ;
  // ceci couvre l'accès direct à l'URL, que masquer un bouton n'empêche pas.
  const { data: sessionEnCours } = await (await createClient()).auth.getUser();

  if (sessionEnCours.user) {
    return {
      erreur:
        'Tu es déjà connecté. Déconnecte-toi d’abord si tu veux remplir ce formulaire pour quelqu’un d’autre.',
    };
  }

  // Non pré-cochée, et refusée si absente : c'est tout l'intérêt d'un
  // consentement explicite.
  if (lu('consentement') !== 'on') {
    return { erreur: 'Merci d’accepter la politique de confidentialité pour continuer.' };
  }

  const reponses = Object.fromEntries(CHAMPS_ATTENDUS.map((champ) => [champ, lu(champ)])) as Record<
    string,
    string
  >;

  const src = lu('src');
  const source: LeadSource = SOURCES[src] ?? 'direct';

  const supabase = createServiceRoleClient();

  // ── 1. Le compte, le consentement et la session ──────────────────────────
  // Mutualisé avec la souscription directe à un abonnement : deux parcours
  // créent un compte, et ils doivent le faire à l'identique — sur le
  // consentement RGPD notamment, dont l'écart ne se découvre qu'au moment où
  // il faut le prouver.
  //
  // `nom` reste vide : le formulaire ne le demande pas, il se collecte au
  // paiement, là où la facturation l'exige réellement.
  const creation = await creerCompteEtSession({
    email,
    prenom: reponses.prenom,
    telephone: reponses.telephone,
    versionConsentement: VERSION_CONSENTEMENT,
  });

  if (!creation.ok) {
    return { erreur: creation.erreur };
  }

  const userId = creation.userId;

  // ── 2. Le lead ───────────────────────────────────────────────────────────
  const { data: lead, error: erreurLead } = await supabase
    .from('leads')
    .insert({
      user_id: userId,
      email,
      prenom: reponses.prenom,
      telephone: reponses.telephone,
      source,
      statut: 'nouveau',
      utm: src ? { src } : {},
      zone_geo: reponses.zone_geo as never,
      tranche_age: reponses.tranche_age as never,
      situation_pro: reponses.situation_pro as never,
      niveau_trading: reponses.niveau_trading as never,
      prop_firm: reponses.prop_firm as never,
      blocage: reponses.blocage as never,
      tranche_budget: reponses.tranche_budget as never,
      delai_objectif: reponses.delai_objectif as never,
      eligible: evaluerEligibilite(reponses as never),
    })
    .select('id')
    .single();

  if (erreurLead || !lead) {
    return { erreur: "L'enregistrement a échoué. Réessaie dans un instant." };
  }

  // ── 3. La soumission complète, telle quelle ──────────────────────────────
  await supabase.from('lead_events').insert({
    lead_id: lead.id,
    type: 'formulaire_soumis',
    payload: reponses,
  });

  // Le consentement et la session sont posés par `creerCompteEtSession`.

  // ── Et le rôle Discord `invité` ? ────────────────────────────────────────
  // Pas ici, et c'est délibéré. Le worker accorde un rôle à un identifiant
  // Discord, qu'il lit dans `discord_links` ; à cet instant, personne ne l'a
  // encore. Empiler un `grant` maintenant ne ferait qu'écrire une ligne que le
  // worker mettrait en échec avec « Compte Discord non lié ».
  //
  // Le `grant` est donc empilé au retour de l'OAuth Discord, dans
  // `api/discord/callback`, quand l'identifiant existe enfin. La liaison est
  // proposée juste après la réservation du créneau — pas avant : rien ne doit
  // s'interposer entre le formulaire et la prise de rendez-vous.

  // `redirect` lève une exception pour interrompre le rendu : elle doit rester
  // hors de tout try/catch, sinon elle est avalée et la page ne change pas.
  redirect('/reserver?inscription=ok');
}
