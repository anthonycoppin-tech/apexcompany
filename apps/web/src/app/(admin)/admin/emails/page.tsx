import { EnTete, Pastille, Tableau, Tuile, Vide, type Ton } from '@/components/admin';
import { envoiConfigure, suiviConfigure } from '@/lib/email/envoi';
import {
  finAccesProche,
  paiementRecu,
  propositionRecue,
  relanceDiscord,
  type Email,
} from '@/lib/email/modeles';
import { TENTATIVES_MAX } from '@/lib/email/registre';
import { dateHeure } from '@/lib/format';
import { urlSite } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

/**
 * `/admin/emails` — ce qui est parti, ce qui a raté, et à quoi ça ressemble.
 *
 * On y arrive avec « je n'ai rien reçu » : la réponse est une ligne du
 * registre, avec l'adresse exacte où l'email est parti. Lu avec la session du
 * staff, donc sous la RLS de `emails_envoyes`.
 *
 * Les aperçus sont rendus sur des données d'exemple par les mêmes fonctions
 * que la tâche : ce qu'on voit ici est ce qui part, au contenu près.
 */

const MODELES: Record<string, { libelle: string; quand: string; exemple: () => Email }> = {
  'paiement-recu': {
    libelle: 'Paiement reçu',
    quand: 'À la tâche qui suit un encaissement.',
    exemple: () =>
      paiementRecu({
        prenom: 'Camille',
        produit: 'Accélérateur (exemple)',
        montantCents: 249000,
        typeProduit: 'accompagnement',
        dateFinAcces: '2026-12-18',
        lienEspace: `${urlSite}/espace`,
      }),
  },
  'proposition-recue': {
    libelle: 'Proposition reçue',
    quand: 'À la tâche qui suit l’émission d’une proposition par le formateur.',
    exemple: () =>
      propositionRecue({
        prenom: 'Camille',
        produit: 'Accélérateur (exemple)',
        montantCents: 199000,
        typeProduit: 'accompagnement',
        expireLe: '2026-10-01',
        lien: `${urlSite}/espace`,
      }),
  },
  'relance-discord': {
    libelle: 'Relance Discord',
    quand: 'Deux jours après l’ouverture d’un accès, si aucun compte Discord n’est relié.',
    exemple: () =>
      relanceDiscord({
        prenom: 'Camille',
        produit: 'Accélérateur (exemple)',
        lien: `${urlSite}/espace/communaute`,
      }),
  },
  'fin-acces-proche': {
    libelle: 'Fin d’accès proche',
    quand: 'Sept jours avant la fin d’un accompagnement.',
    exemple: () =>
      finAccesProche({
        prenom: 'Camille',
        produit: 'Accélérateur (exemple)',
        dateFin: '2026-12-18',
        lien: `${urlSite}/espace`,
      }),
  },
};

/**
 * « Envoyé » et « Reçu » ne sont pas la même chose, et c'est tout l'intérêt de
 * les distinguer ici : `envoye` dit seulement que Resend a accepté la requête.
 * Tant que le webhook n'est pas branché, aucune ligne ne dépasse cet état — le
 * bandeau plus bas le dit, pour qu'on ne lise pas « Envoyé » comme « arrivé ».
 */
function etat(statut: string, tentatives: number): { libelle: string; ton: Ton } {
  if (statut === 'livre') return { libelle: 'Reçu', ton: 'bon' };
  if (statut === 'envoye') return { libelle: 'Envoyé', ton: 'attente' };
  if (statut === 'rebond') return { libelle: 'Rebond', ton: 'probleme' };
  if (statut === 'plainte') return { libelle: 'Indésirable', ton: 'probleme' };
  if (statut === 'en_cours') return { libelle: 'En cours', ton: 'attente' };
  if (tentatives >= TENTATIVES_MAX) return { libelle: 'Abandonné', ton: 'probleme' };
  return { libelle: `Échec (${tentatives}/${TENTATIVES_MAX})`, ton: 'attente' };
}

export default async function Page() {
  const supabase = await createClient();
  const { data: lignes } = await supabase
    .from('emails_envoyes')
    .select('id, modele, destinataire, statut, tentatives, erreur, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);

  const envois = lignes ?? [];
  const abandonnes = envois.filter(
    (l) => l.statut === 'echec' && l.tentatives >= TENTATIVES_MAX,
  ).length;
  const recus = envois.filter((l) => l.statut === 'livre').length;
  const refuses = envois.filter((l) => l.statut === 'rebond' || l.statut === 'plainte').length;
  const configure = envoiConfigure();
  const suivi = suiviConfigure();

  return (
    <>
      <EnTete
        titre="Emails"
        description="Emails automatiques envoyés aux clients : registre et aperçu"
      />

      {!configure && (
        <p className="rounded-carte border border-filet bg-fond p-4 text-sm text-encre-doux">
          <strong className="text-encre">Aucun email ne part.</strong> <code>RESEND_API_KEY</code>{' '}
          ou <code>EMAIL_FROM</code> n’est pas renseignée : la tâche horaire refuse de tourner
          plutôt que d’épuiser les tentatives. Les aperçus ci-dessous restent justes.
        </p>
      )}

      {configure && !suivi && (
        <p className="rounded-carte border border-filet bg-fond p-4 text-sm text-encre-doux">
          <strong className="text-encre">« Envoyé » ne veut pas dire « reçu ».</strong>{' '}
          <code>RESEND_WEBHOOK_SECRET</code> n’est pas renseignée : le webhook{' '}
          <code>api/resend</code> ne tourne pas, et aucune ligne ne dépassera l’état « Envoyé ». Un
          rebond ou une plainte restera invisible. Mise en place dans{' '}
          <code>docs/08-CE-QUI-MANQUE.md</code>.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tuile
          libelle="Envoi"
          valeur={configure ? 'Branché' : 'Non branché'}
          ton={configure ? 'bon' : 'probleme'}
          detail="Resend, tâche toutes les heures"
        />
        <Tuile
          libelle="Suivi des réceptions"
          valeur={suivi ? 'Branché' : 'Non branché'}
          ton={suivi ? 'bon' : 'probleme'}
          detail="Webhook Resend : livraisons, rebonds, plaintes"
        />
        <Tuile
          libelle="Reçus"
          valeur={suivi ? String(recus) : '—'}
          detail={suivi ? 'Confirmés par le destinataire' : 'Inconnu sans le webhook'}
        />
        <Tuile
          libelle="À traiter"
          valeur={String(refuses + abandonnes)}
          ton={refuses + abandonnes > 0 ? 'probleme' : 'neutre'}
          detail={`Rebonds, plaintes, et abandons après ${TENTATIVES_MAX} tentatives`}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Derniers envois</h2>
        {envois.length === 0 ? (
          <Vide>
            Aucun email n’a encore été envoyé. Le registre se remplit dès que la tâche tourne avec
            une clé d’envoi.
          </Vide>
        ) : (
          <div className="rounded-carte border border-filet bg-fond p-5">
            <Tableau colonnes={['Quand', 'Email', 'Destinataire', 'État', 'Erreur']}>
              {envois.map((l) => {
                const e = etat(l.statut, l.tentatives);
                return (
                  <tr key={l.id} className="border-b border-filet align-top last:border-0">
                    <td className="py-3 pr-4 whitespace-nowrap">{dateHeure(l.updated_at)}</td>
                    <td className="py-3 pr-4">{MODELES[l.modele]?.libelle ?? l.modele}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{l.destinataire}</td>
                    <td className="py-3 pr-4">
                      <Pastille ton={e.ton}>{e.libelle}</Pastille>
                    </td>
                    <td className="py-3 text-encre-doux">{l.erreur ?? '—'}</td>
                  </tr>
                );
              })}
            </Tableau>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Les modèles</h2>
        <p className="text-sm text-encre-doux">
          Brouillons à faire relire par le client : le texte, le ton et la signature sont les siens.
          Données d’exemple.
        </p>
        {Object.entries(MODELES).map(([cle, m]) => {
          const email = m.exemple();
          return (
            <details key={cle} className="rounded-carte border border-filet bg-fond p-5">
              <summary className="cursor-pointer font-medium">
                {m.libelle}
                <span className="block text-sm font-normal text-encre-doux">{m.quand}</span>
              </summary>
              <p className="mt-4 text-sm">
                <span className="text-encre-doux">Sujet : </span>
                {email.sujet}
              </p>
              {/* Bac à sable sans script : le HTML d'un email n'a rien à exécuter ici. */}
              <iframe
                title={`Aperçu — ${m.libelle}`}
                srcDoc={email.html}
                sandbox=""
                className="mt-3 h-[36rem] w-full rounded-carte border border-filet"
              />
            </details>
          );
        })}
      </section>
    </>
  );
}
