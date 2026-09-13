import Link from 'next/link';

import { Pastille } from '@/components/admin';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * « Demande quelqu'un » — la file de travail du tableau de bord.
 *
 * **Des personnes, pas des nombres.** Le reste de l'écran compte : « incidents
 * techniques : 3 » dit qu'il se passe quelque chose, sans dire à qui ni quoi
 * faire, et un compteur qu'on ne sait pas par quel bout prendre finit par
 * s'ignorer tout seul. Ici, chaque ligne nomme une personne et mène à sa fiche,
 * où le geste existe déjà.
 *
 * **Posée là où l'on va déjà.** `/admin/logs` existe et personne ne l'ouvre —
 * c'est un écran de développeur. Un récap hebdomadaire par email échouerait de
 * la même façon, avec trois semaines de retard, en finissant dans un filtre.
 * Le tableau de bord, lui, s'ouvre le matin.
 *
 * **Rien ici n'est deviné.** Chaque cas correspond à une panne constatée :
 * quelqu'un qui a payé sans lier son Discord, quelqu'un qui l'a lié sans
 * rejoindre le serveur, une ligne de file abandonnée. Les trois se sont
 * produits entre le 12 et le 13 septembre 2026.
 */

type Cas = {
  userId: string;
  nom: string;
  motif: string;
  quoiFaire: string;
  ton: 'probleme' | 'attente';
};

export async function DemandeQuelquun() {
  // `service_role` : cette section lit `discord_sync_queue` et `automation_logs`,
  // que la RLS ferme à tout le monde. Le composant n'est rendu que dans
  // `(admin)`, derrière la garde de layout.
  const admin = createServiceRoleClient();

  const [inscriptionsActives, liens, abandonnees, derniereReconciliation] = await Promise.all([
    admin.from('inscriptions').select('user_id').eq('statut', 'active'),
    admin.from('discord_links').select('user_id'),
    admin.from('discord_sync_queue').select('user_id, erreur').eq('statut', 'abandonne'),
    admin
      .from('automation_logs')
      .select('details, created_at')
      .eq('declencheur', 'discord.reconciliation')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lies = new Set((liens.data ?? []).map((l) => l.user_id));

  const sansLiaison = [
    ...new Set((inscriptionsActives.data ?? []).map((i) => i.user_id).filter((u) => !lies.has(u))),
  ];

  // La seule source de cette information : la base ne peut pas savoir qui est
  // présent sur le serveur. Si la réconciliation n'a jamais tourné, on ne sait
  // rien — et on le dit plus bas plutôt que d'afficher une liste vide
  // rassurante.
  const absents = ((derniereReconciliation.data?.details as { absents?: string[] } | null)
    ?.absents ?? []) as string[];

  const enEchec = [...new Set((abandonnees.data ?? []).map((l) => l.user_id))];

  const tousLesIds = [...new Set([...sansLiaison, ...absents, ...enEchec])];

  if (tousLesIds.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-encre-doux">Demande quelqu’un</h2>
        <div className="rounded-carte border border-filet bg-fond p-5 text-sm text-encre-doux">
          Rien à traiter.
          {!derniereReconciliation.data && (
            <>
              {' '}
              <strong className="text-encre">La réconciliation n’a jamais tourné</strong> : on ne
              sait donc pas qui a lié son compte sans rejoindre le serveur.
            </>
          )}
        </div>
      </section>
    );
  }

  const { data: profils } = await admin
    .from('profiles')
    .select('id, prenom, nom, email')
    .in('id', tousLesIds);

  const nomDe = (id: string) => {
    const p = profils?.find((x) => x.id === id);
    if (!p) return id;
    const complet = [p.prenom, p.nom].filter(Boolean).join(' ').trim();
    return complet || p.email;
  };

  const cas: Cas[] = [
    ...sansLiaison.map((userId) => ({
      userId,
      nom: nomDe(userId),
      motif: 'A un accès actif, sans compte Discord lié',
      quoiFaire: 'Il doit le connecter lui-même depuis son espace. Le relancer.',
      ton: 'probleme' as const,
    })),
    ...absents
      .filter((u) => !sansLiaison.includes(u))
      .map((userId) => ({
        userId,
        nom: nomDe(userId),
        motif: 'Compte Discord lié, mais absent du serveur',
        quoiFaire: 'Lui envoyer l’invitation au serveur.',
        ton: 'attente' as const,
      })),
    ...enEchec
      .filter((u) => !sansLiaison.includes(u) && !absents.includes(u))
      .map((userId) => ({
        userId,
        nom: nomDe(userId),
        motif: 'Attribution de rôle abandonnée',
        quoiFaire: 'Corriger la cause, puis « Réattribuer les accès Discord » sur sa fiche.',
        ton: 'probleme' as const,
      })),
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-encre-doux">Demande quelqu’un</h2>
        <Link href="/admin/aide" className="text-xs text-accent hover:underline">
          Que faire ? →
        </Link>
      </div>

      <ul className="space-y-2">
        {cas.map((c) => (
          <li
            key={`${c.userId}-${c.motif}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-carte border border-filet bg-fond p-4"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/clients/${c.userId}`} className="font-medium hover:underline">
                  {c.nom}
                </Link>
                <Pastille ton={c.ton}>{c.motif}</Pastille>
              </div>
              <p className="mt-1 text-sm text-encre-doux">{c.quoiFaire}</p>
            </div>
            <Link
              href={`/admin/clients/${c.userId}`}
              className="text-sm text-accent hover:underline"
            >
              Ouvrir sa fiche →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
