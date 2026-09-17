// Pose sur un projet Supabase hébergé ce que la connexion par email attend :
// l'adresse de retour `/connexion/confirmer` et les deux modèles d'email de
// `supabase/templates/`.
//
// Pourquoi un script plutôt que le tableau de bord : ces réglages vivent hors
// du dépôt, et il faudra les refaire à l'identique sur la production. Un
// modèle recopié à la main est un modèle qui diverge.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... npm run auth:modeles -- [ref-du-projet]
//   npm run auth:modeles -- [ref-du-projet] --jeton-fichier chemin/du/jeton
//
// Sans référence, le projet lié (`supabase/.temp/project-ref`). Le jeton se
// crée sur supabase.com/dashboard/account/tokens, et se supprime après usage :
// il ouvre tous les projets du compte.
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const option = (nom) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};

const fichierJeton = option('--jeton-fichier');
const jeton = (
  fichierJeton ? readFileSync(fichierJeton, 'utf8') : (process.env.SUPABASE_ACCESS_TOKEN ?? '')
).trim();
const ref =
  args[0] ??
  (existsSync('supabase/.temp/project-ref')
    ? readFileSync('supabase/.temp/project-ref', 'utf8').trim()
    : '');

if (!jeton || !ref) {
  console.error('Jeton ou référence de projet manquant. Voir l’en-tête de ce fichier.');
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const entetes = { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' };

const reponse = await fetch(API, { headers: entetes });
if (!reponse.ok) {
  console.error(`Lecture refusée (${reponse.status}) : ${await reponse.text()}`);
  process.exit(1);
}
const actuel = await reponse.json();

// Le service d'envoi intégré à Supabase n'écrit qu'aux membres de
// l'organisation, quelques fois par heure : les modèles peuvent être posés (sur
// un plan Pro), mais aucun vrai client ne les recevra.
const sansSmtp = !actuel.smtp_host;

// Les modèles annoncent « au bout d'une heure ». Une durée différente rendrait
// la phrase fausse sans que rien ne casse.
if (actuel.mailer_otp_exp !== 3600) {
  console.error(
    `Durée des liens : ${actuel.mailer_otp_exp} s, les modèles disent une heure. ` +
      'Ajuster « Email OTP Expiration » ou le texte de supabase/templates/.',
  );
  process.exit(1);
}

const retour = `${actuel.site_url.replace(/\/$/, '')}/connexion/confirmer`;
const autorisees = new Set((actuel.uri_allow_list ?? '').split(',').filter(Boolean));
autorisees.add(retour);

const modele = (nom) => readFileSync(`supabase/templates/${nom}.html`, 'utf8');

const changements = {
  uri_allow_list: [...autorisees].join(','),
  mailer_subjects_magic_link: 'Votre lien de connexion',
  mailer_templates_magic_link_content: modele('connexion'),
  mailer_subjects_confirmation: 'Confirmez votre adresse email',
  mailer_templates_confirmation_content: modele('confirmation'),
};

const ecriture = await fetch(API, {
  method: 'PATCH',
  headers: entetes,
  body: JSON.stringify(changements),
});
if (!ecriture.ok) {
  console.error(`Écriture refusée (${ecriture.status}) : ${await ecriture.text()}`);
  if (sansSmtp) {
    // Le refus attendu d'un projet gratuit sans SMTP : c'est l'un ou l'autre
    // qu'il faut, et le message de l'API ne le dit qu'en anglais.
    console.error(
      'Un projet gratuit n’accepte des modèles qu’avec un SMTP configuré : passer en Pro, ' +
        'ou brancher le service d’envoi (Authentication → Emails → SMTP Settings).',
    );
  }
  process.exit(1);
}

console.log(`Projet ${ref} : modèles posés, adresse de retour ${retour} autorisée.`);
if (sansSmtp) {
  console.log(
    'Attention : aucun SMTP. Seuls les membres de l’organisation Supabase recevront ces emails.',
  );
}
if (!actuel.site_url.startsWith('https://')) {
  console.log(`Site URL vaut ${actuel.site_url} — correct pour le dev, pas pour la production.`);
}
