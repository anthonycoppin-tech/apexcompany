import { METADONNEES_LEGALES, PageLegale } from '@/components/page-legale';
import { Carte } from '@/components/ui';
import { EMAIL_CONTACT } from '@/lib/contact';

export const metadata = { title: 'Politique de confidentialité', ...METADONNEES_LEGALES };

/**
 * `/confidentialite` — la seule des six pages qui dit déjà quelque chose.
 *
 * Trois formulaires y renvoient, et celui de qualification demande un
 * consentement « dans les conditions décrites par la politique de
 * confidentialité ». Tant que cette page reste vide, on fait accepter des
 * conditions qui n'existent pas. On ne peut pas refermer entièrement ça sans le
 * juriste, mais on peut au moins décrire ce que le code fait réellement.
 *
 * **Ce qui est écrit ici est de l'observation, pas de l'engagement** : les
 * champs viennent de `lib/qualification/questionnaire.ts`, les services de ceux
 * réellement branchés (`/admin/parametres`). Rien sur les durées de
 * conservation, les bases légales ou les transferts hors Union — ça se décide,
 * et affirmer le contraire serait pire que le silence.
 *
 * L'inventaire complet, destiné au juriste, est dans `/admin/legal`.
 */
const COLLECTE: Array<{ quand: string; quoi: string }> = [
  {
    quand: 'Quand vous remplissez le formulaire d’orientation',
    quoi: 'Votre prénom, votre adresse email, votre numéro de téléphone, et vos réponses aux questions posées — région, tranche d’âge, situation professionnelle, expérience, objectif, budget envisagé, échéance.',
  },
  {
    quand: 'Quand vous prenez rendez-vous',
    quoi: 'La date retenue et le fait que le rendez-vous a eu lieu ou non. Le formateur y ajoute son compte rendu.',
  },
  {
    quand: 'Quand vous reliez votre compte Discord',
    quoi: 'Votre identifiant Discord, pour vous donner accès aux espaces auxquels vous avez droit et les retirer quand l’accès prend fin.',
  },
  {
    quand: 'Quand vous payez',
    quoi: 'Le montant, la date et les références de la transaction. Votre numéro de carte ne nous parvient jamais : il est saisi chez notre prestataire de paiement.',
  },
  {
    quand: 'À votre arrivée sur le site',
    quoi: 'Si vous venez d’un lien de campagne, les paramètres que ce lien contient — pour savoir ce qui vous a amené ici. Rien d’autre : aucune mesure d’audience ne tourne sur ce site.',
  },
  {
    quand: 'Votre consentement lui-même',
    quoi: 'La date à laquelle vous l’avez donné et la version du texte que vous avez lue, pour pouvoir établir à quoi vous avez consenti exactement. Votre adresse IP n’est pas enregistrée.',
  },
];

const SERVICES: Array<{ nom: string; role: string }> = [
  { nom: 'Supabase', role: 'héberge la base de données et gère les comptes' },
  { nom: 'Stripe', role: 'encaisse les paiements et conserve les moyens de paiement' },
  { nom: 'Discord', role: 'porte la communauté et les accès qui s’y rattachent' },
  { nom: 'Cal.com', role: 'gère la prise de rendez-vous' },
];

export default function Page() {
  return (
    <PageLegale
      titre="Politique de confidentialité"
      contiendra="Quelles données sont collectées, pourquoi, combien de temps elles sont conservées, avec qui elles sont partagées, et comment exercer vos droits."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Ce que nous pouvons déjà vous dire</h2>
          <p className="leading-relaxed text-encre-doux">
            La rédaction complète attend un point juridique. Ce qui suit décrit le fonctionnement
            réel du site, et ne changera pas : c’est ce que le code fait aujourd’hui.
          </p>
        </div>

        <Carte className="space-y-5">
          <h3 className="font-semibold">Les données que nous collectons</h3>
          <dl className="space-y-4">
            {COLLECTE.map((c) => (
              <div key={c.quand} className="space-y-1">
                <dt className="text-sm font-medium">{c.quand}</dt>
                <dd className="text-sm leading-relaxed text-encre-doux">{c.quoi}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-filet pt-4 text-sm leading-relaxed text-encre-doux">
            Rien n’est enregistré tant que vous n’avez pas terminé le formulaire : si vous
            l’abandonnez en cours de route, il ne reste aucune trace de vos réponses.
          </p>
        </Carte>

        <Carte className="space-y-4">
          <h3 className="font-semibold">Les services chez qui elles transitent</h3>
          <ul className="space-y-2 text-sm">
            {SERVICES.map((s) => (
              <li key={s.nom} className="flex flex-wrap gap-x-2 text-encre-doux">
                <span className="font-medium text-encre">{s.nom}</span>
                <span>— {s.role}.</span>
              </li>
            ))}
          </ul>
          <p className="text-sm leading-relaxed text-encre-doux">
            Aucune donnée n’est vendue, ni transmise à un annonceur. Le site ne dépose aucun traceur
            publicitaire et n’utilise aucun outil de mesure d’audience.
          </p>
        </Carte>

        <Carte className="space-y-3">
          <h3 className="font-semibold">Vos droits, dès maintenant</h3>
          <p className="text-sm leading-relaxed text-encre-doux">
            Vous pouvez demander à consulter les données qui vous concernent, à les corriger ou à
            les faire supprimer, sans attendre que cette page soit complète. Écrivez à{' '}
            <a href={`mailto:${EMAIL_CONTACT}`} className="font-medium text-accent underline">
              {EMAIL_CONTACT}
            </a>{' '}
            : la demande est traitée, et la réponse vous est faite par écrit.
          </p>
        </Carte>
      </div>
    </PageLegale>
  );
}
