import { formaterMontant } from '@apex/db';

import { EnTete, Pastille, Tuile, Vide } from '@/components/admin';
import { dateCourte } from '@/lib/format';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

import { FormulaireRattachement, type Produit } from './formulaire';

/**
 * `/admin/paiements/rattrapage` — les encaissements Whop qui n'appartiennent à
 * personne.
 *
 * **Pourquoi cet écran existe.** Le client a diffusé seize liens de paiement
 * Whop avant que le site ne sache en ouvrir, et un lien envoyé en message privé
 * ne se rappelle pas. Un paiement qui arrive par l'un d'eux n'a aucune
 * métadonnée : ni compte, ni produit. Sans cet écran, le webhook ne pourrait
 * qu'acquitter et journaliser, et le symptôme côté client serait « j'ai payé et
 * je n'ai pas accès » — en silence, découvert seulement s'il se plaint.
 *
 * **Une file qui nomme, pas qui compte.** Même règle que « Demande quelqu'un »
 * sur le tableau de bord : chaque ligne porte l'adresse de l'acheteur, ce qu'il
 * a acheté et combien il a payé, et le geste est sur la ligne. Un compteur
 * « 3 paiements non rattachés » ne dit pas par quel bout le prendre, et finit
 * par s'ignorer tout seul.
 *
 * **Ce que l'écran ne devine pas.** Le webhook connaît le plan Whop, donc
 * souvent le produit ; il connaît l'adresse de l'acheteur. Il ne s'en sert que
 * pour proposer — l'administrateur confirme. Ouvrir un accès sur une
 * ressemblance, ce serait affirmer ce qu'on ne sait pas, et ces paiements
 * n'ont de surcroît aucune acceptation des CGV enregistrée.
 *
 * **La file se vide toute seule.** On ne marque rien comme traité : on écarte
 * les paiements qui ont déjà un encaissement en base. Un paiement rattaché ici,
 * mais aussi un paiement dont le webhook aurait finalement reçu une seconde
 * notification complète, disparaissent donc sans qu'un drapeau ait à être posé
 * juste — un drapeau qu'on oublie de poser laisse une ligne fantôme pour
 * toujours.
 */
export default async function Page() {
  // `service_role` : `automation_logs` est fermée par la RLS à tout le monde.
  // La page n'est rendue que dans `(admin)`, derrière la garde de layout.
  const admin = createServiceRoleClient();

  const [{ data: journaux }, { data: catalogue }] = await Promise.all([
    admin
      .from('automation_logs')
      .select('id, details, created_at')
      .eq('declencheur', 'whop.rattrapage')
      .eq('statut', 'echec')
      .order('created_at', { ascending: false })
      .limit(200),
    admin.from('formations').select('id, titre, actif, whop_plan_id').order('ordre'),
  ]);

  const produits: Produit[] = (catalogue ?? []).map((f) => ({
    id: f.id,
    titre: f.titre,
    actif: f.actif,
  }));

  const lignes = (journaux ?? []).map((j) => {
    const d = (j.details ?? {}) as {
      raison?: string;
      paiement?: string | null;
      email?: string | null;
      plan?: string | null;
      produit?: string | null;
      montant_cents?: number | null;
      devise?: string | null;
    };

    return {
      id: j.id,
      date: j.created_at,
      raison: d.raison ?? 'Inconnue',
      paiement: d.paiement ?? null,
      email: d.email ?? null,
      plan: d.plan ?? null,
      produit: d.produit ?? null,
      montantCents: typeof d.montant_cents === 'number' ? d.montant_cents : null,
      devise: d.devise ?? 'EUR',
      formationId: (catalogue ?? []).find((f) => f.whop_plan_id && f.whop_plan_id === d.plan)?.id,
    };
  });

  // Les paiements déjà encaissés ne sont plus à rattacher, quelle que soit la
  // façon dont ils l'ont été.
  const references = lignes.map((l) => l.paiement).filter((p): p is string => Boolean(p));

  const { data: dejaEncaisses } = references.length
    ? await admin
        .from('payments')
        .select('provider_payment_id')
        .eq('provider', 'whop')
        .in('provider_payment_id', references)
    : { data: [] };

  const encaisses = new Set((dejaEncaisses ?? []).map((p) => p.provider_payment_id));
  const aTraiter = lignes.filter((l) => !l.paiement || !encaisses.has(l.paiement));

  const enJeu = aTraiter.reduce((t, l) => t + (l.montantCents ?? 0), 0);

  return (
    <>
      <EnTete
        titre="Paiements à rattacher"
        description="Encaissements Whop arrivés sans métadonnées — par un lien diffusé hors du site."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tuile
          libelle="En attente"
          valeur={String(aTraiter.length)}
          detail="clients qui ont payé sans accès"
          ton={aTraiter.length > 0 ? 'probleme' : 'bon'}
        />
        <Tuile libelle="Montant concerné" valeur={formaterMontant(enJeu)} />
      </div>

      {aTraiter.length === 0 ? (
        <Vide>
          Tous les encaissements Whop sont rattachés à un compte. Les paiements ouverts par un lien
          diffusé hors du site atterrissent ici — pensez à désactiver ces liens côté Whop une fois
          le site en service.
        </Vide>
      ) : (
        <ul className="space-y-3">
          {aTraiter.map((l) => (
            <li key={l.id} className="rounded-carte border border-filet bg-fond p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{l.email ?? 'Acheteur inconnu'}</span>
                    <Pastille ton="probleme">{l.raison}</Pastille>
                  </div>
                  <p className="text-sm text-encre-doux">
                    {l.produit ? `Plan reconnu : ${l.produit}` : `Plan inconnu : ${l.plan ?? '—'}`}
                    {l.paiement ? ` · ${l.paiement}` : ''}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-titre text-lg font-bold tabular-nums">
                    {l.montantCents === null
                      ? 'Montant illisible'
                      : formaterMontant(l.montantCents, l.devise)}
                  </p>
                  <p className="text-encre-faible">{dateCourte(l.date)}</p>
                </div>
              </div>

              <p className="mt-3 text-sm text-encre-faible">
                Ce paiement n’a <strong className="text-encre">aucune acceptation des CGV</strong>{' '}
                enregistrée : il n’est pas passé par le site. Le rattacher ouvre l’accès et émet la
                facture, mais ne crée pas cette preuve.
              </p>

              <FormulaireRattachement
                logId={l.id}
                emailPropose={l.email}
                produitPropose={l.formationId ?? null}
                produits={produits}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
