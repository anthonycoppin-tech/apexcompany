'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { MessageBloc } from '@/components/message';
import { BoutonAction, CHAMP } from '@/components/ui';
import { REPOS, messageDe } from '@/lib/messages/types';

import { effacer, verifierEffacement } from './rgpd-actions';

/**
 * Les demandes RGPD d'une personne : copie de ses données, ou effacement.
 *
 * L'effacement se fait en deux temps, et le second exige de retaper l'adresse
 * de la fiche. La vérification dit exactement ce qui partira, ou pourquoi rien
 * ne peut partir — une personne qui a acheté ne s'efface pas d'ici.
 */
export function DonneesPersonnelles({ leadId, email }: { leadId: string; email: string }) {
  const [verification, verifier, verifie] = useActionState(verifierEffacement, REPOS);
  const [resultat, lancer, efface] = useActionState(effacer, REPOS);

  if (resultat.statut === 'succes') {
    return (
      <div className="space-y-3">
        <MessageBloc message={messageDe(resultat)} />
        <Link href="/admin/crm/leads" className="text-sm text-accent hover:underline">
          ← Retour aux prospects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-carte border border-filet bg-fond p-5 text-sm">
      <div className="space-y-1">
        <p className="font-medium">Copie de ses données</p>
        <p className="text-encre-doux">
          Tout ce que la plateforme sait de cette personne, notes internes comprises, dans un
          fichier à relire avant de le lui envoyer. La réponse est due sous un mois.
        </p>
        <a
          href={`/api/rgpd/export?lead=${leadId}`}
          download
          className="inline-block font-semibold text-accent hover:underline"
        >
          Télécharger ses données →
        </a>
      </div>

      <div className="space-y-2 border-t border-filet pt-4">
        <p className="font-medium">Effacement à sa demande</p>
        <form action={verifier}>
          <input type="hidden" name="lead_id" value={leadId} />
          <BoutonAction
            type="submit"
            variante="secondaire"
            disabled={verifie}
            className="px-4 py-2"
          >
            {verifie ? 'Vérification…' : 'Vérifier ce qui serait effacé'}
          </BoutonAction>
        </form>
        <MessageBloc message={messageDe(verification)} />

        {verification.statut === 'succes' && (
          <form action={lancer} className="space-y-2">
            <input type="hidden" name="lead_id" value={leadId} />
            <label className="block space-y-1">
              <span className="text-encre-doux">
                Pour confirmer, retapez l’adresse <strong className="text-encre">{email}</strong>
              </span>
              <input
                name="confirmation"
                type="email"
                autoComplete="off"
                required
                className={CHAMP}
              />
            </label>
            <BoutonAction type="submit" disabled={efface} className="bg-alerte px-4 py-2">
              {efface ? 'Effacement…' : 'Effacer définitivement'}
            </BoutonAction>
            <MessageBloc message={messageDe(resultat)} />
          </form>
        )}
      </div>
    </div>
  );
}
