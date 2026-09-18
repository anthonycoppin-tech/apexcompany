import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@apex/db';

import { urlSite } from '@/lib/site';

import { envoyer } from './envoi';
import {
  finAccesProche,
  paiementRecu,
  propositionRecue,
  relanceDiscord,
  type Email,
  type TypeProduit,
} from './modeles';
import { cleIdempotence, peutReprendre } from './registre';

/**
 * La tâche horaire des emails transactionnels.
 *
 * **Elle part de l'état de la base, jamais d'un événement.** Un webhook ne
 * déclenche aucun email : la tâche relit ce qui est vrai — une commande payée,
 * une proposition envoyée, un accès sans Discord, une fin d'accès proche — et
 * envoie ce qui n'est pas encore parti. Un webhook rejoué ne peut donc rien
 * doubler, et une panne du prestataire ne fait rien oublier : la tâche suivante
 * retrouve le même état.
 *
 * Les fenêtres de temps (sept jours, quatorze jours) ne servent qu'à une
 * chose : que le premier passage en production n'écrive pas à des clients pour
 * des événements vieux de plusieurs mois. Le registre fait le reste.
 */

type Client = SupabaseClient<Database>;

type Candidat = {
  modele: string;
  cle: string;
  userId: string;
  /** Construit une fois le destinataire connu : le prénom vient du profil. */
  construire: (prenom: string | null) => Email;
};

export type Bilan = {
  candidats: number;
  envoyes: number;
  echecs: number;
  ignores: number;
  erreurs: string[];
};

const JOUR = 24 * 60 * 60 * 1000;
const ilYa = (jours: number, maintenant: Date) =>
  new Date(maintenant.getTime() - jours * JOUR).toISOString();
const jourISO = (d: Date) => d.toISOString().slice(0, 10);

async function paiementsRecus(db: Client, maintenant: Date): Promise<Candidat[]> {
  const { data, error } = await db
    .from('payments')
    .select(
      'order_id, orders!inner(id, statut, user_id, montant_cents, devise, formations(titre, type_produit))',
    )
    .eq('statut', 'reussi')
    .gte('paid_at', ilYa(7, maintenant));
  if (error) throw new Error(`paiements : ${error.message}`);

  // Un abonnement encaisse chaque mois sur la même commande : la clé est la
  // commande, donc un seul « Paiement reçu », à l'achat.
  const commandes = new Map<string, NonNullable<(typeof data)[number]['orders']>>();
  for (const p of data ?? []) {
    const o = p.orders;
    if (o && o.statut === 'payee' && o.user_id) commandes.set(o.id, o);
  }
  if (commandes.size === 0) return [];

  const { data: inscriptions, error: errInscr } = await db
    .from('inscriptions')
    .select('order_id, date_fin_acces')
    .in('order_id', [...commandes.keys()]);
  if (errInscr) throw new Error(`inscriptions : ${errInscr.message}`);
  const finParCommande = new Map((inscriptions ?? []).map((i) => [i.order_id, i.date_fin_acces]));

  return [...commandes.values()].flatMap((o) => {
    // Sans inscription, l'accès n'est pas ouvert : on ne l'annonce pas. La
    // tâche suivante réessaiera, `traiter_paiement()` écrivant les deux ensemble.
    if (!o.formations || !finParCommande.has(o.id)) return [];
    const produit = o.formations;
    return [
      {
        modele: 'paiement-recu',
        cle: o.id,
        userId: o.user_id!,
        construire: (prenom) =>
          paiementRecu({
            prenom,
            produit: produit.titre,
            montantCents: o.montant_cents,
            devise: o.devise,
            typeProduit: produit.type_produit as TypeProduit,
            dateFinAcces: finParCommande.get(o.id) ?? null,
            lienEspace: `${urlSite}/espace`,
          }),
      },
    ];
  });
}

async function propositionsRecues(db: Client, maintenant: Date): Promise<Candidat[]> {
  const { data, error } = await db
    .from('propositions')
    .select('id, user_id, montant_cents, devise, expire_le, formations(titre, type_produit)')
    .eq('statut', 'envoyee')
    .gte('created_at', ilYa(7, maintenant))
    .or(`expire_le.is.null,expire_le.gte.${maintenant.toISOString()}`);
  if (error) throw new Error(`propositions : ${error.message}`);

  return (data ?? []).flatMap((p) => {
    if (!p.formations) return [];
    const produit = p.formations;
    return [
      {
        modele: 'proposition-recue',
        cle: p.id,
        userId: p.user_id,
        construire: (prenom) =>
          propositionRecue({
            prenom,
            produit: produit.titre,
            montantCents: p.montant_cents,
            devise: p.devise,
            typeProduit: produit.type_produit as TypeProduit,
            expireLe: p.expire_le,
            lien: `${urlSite}/espace/propositions/${p.id}`,
          }),
      },
    ];
  });
}

async function relancesDiscord(db: Client, maintenant: Date): Promise<Candidat[]> {
  const { data, error } = await db
    .from('inscriptions')
    .select('user_id, created_at, formations(titre)')
    .eq('statut', 'active')
    .lte('created_at', ilYa(2, maintenant))
    .gte('created_at', ilYa(14, maintenant))
    .order('created_at');
  if (error) throw new Error(`inscriptions : ${error.message}`);
  if (!data?.length) return [];

  const { data: liens, error: errLiens } = await db
    .from('discord_links')
    .select('user_id')
    .in('user_id', [...new Set(data.map((i) => i.user_id))]);
  if (errLiens) throw new Error(`discord_links : ${errLiens.message}`);
  const relies = new Set((liens ?? []).map((l) => l.user_id));

  // Une relance par personne, pas par produit : deux achats sans Discord, c'est
  // un seul geste à faire. Le produit cité est le plus ancien.
  const parPersonne = new Map<string, string>();
  for (const i of data) {
    if (!relies.has(i.user_id) && !parPersonne.has(i.user_id) && i.formations) {
      parPersonne.set(i.user_id, i.formations.titre);
    }
  }

  return [...parPersonne].map(([userId, produit]) => ({
    modele: 'relance-discord',
    cle: userId,
    userId,
    construire: (prenom) =>
      relanceDiscord({ prenom, produit, lien: `${urlSite}/espace/communaute` }),
  }));
}

async function finsAccesProches(db: Client, maintenant: Date): Promise<Candidat[]> {
  const { data, error } = await db
    .from('inscriptions')
    .select('id, user_id, date_fin_acces, formations!inner(titre, type_produit)')
    .eq('statut', 'active')
    .eq('formations.type_produit', 'accompagnement')
    .gte('date_fin_acces', jourISO(maintenant))
    .lte('date_fin_acces', jourISO(new Date(maintenant.getTime() + 7 * JOUR)));
  if (error) throw new Error(`fins d'accès : ${error.message}`);

  return (data ?? []).flatMap((i) => {
    if (!i.date_fin_acces || !i.formations) return [];
    const dateFin = i.date_fin_acces;
    const produit = i.formations.titre;
    // La date dans la clé : un rachat prolonge l'accès, et la nouvelle fin
    // mérite son propre avertissement.
    return [
      {
        modele: 'fin-acces-proche',
        cle: `${i.id}:${dateFin}`,
        userId: i.user_id,
        construire: (prenom) =>
          finAccesProche({ prenom, produit, dateFin, lien: `${urlSite}/espace` }),
      },
    ];
  });
}

/**
 * Réserve la ligne du registre. `true` si cette exécution a le droit
 * d'envoyer, `false` si l'email est déjà parti, en cours ailleurs, ou a épuisé
 * ses tentatives.
 */
async function reserver(db: Client, c: Candidat, destinataire: string, maintenant: Date) {
  const { error } = await db.from('emails_envoyes').insert({
    modele: c.modele,
    cle: c.cle,
    user_id: c.userId,
    destinataire,
    tentatives: 1,
  });
  if (!error) return true;
  if (error.code !== '23505') throw new Error(`registre : ${error.message}`);

  const { data: ligne } = await db
    .from('emails_envoyes')
    .select('id, statut, tentatives, updated_at')
    .eq('modele', c.modele)
    .eq('cle', c.cle)
    .single();
  if (!ligne || !peutReprendre(ligne, maintenant)) return false;

  // Reprise conditionnée à l'état lu : deux exécutions concurrentes ne
  // reprennent pas la même ligne, la seconde ne met rien à jour.
  const { data: reprise } = await db
    .from('emails_envoyes')
    .update({
      statut: 'en_cours',
      tentatives: ligne.tentatives + 1,
      destinataire,
      erreur: null,
    })
    .eq('id', ligne.id)
    .eq('statut', ligne.statut)
    .eq('tentatives', ligne.tentatives)
    .select('id');
  return (reprise?.length ?? 0) === 1;
}

export async function executerTacheEmails(db: Client, maintenant = new Date()): Promise<Bilan> {
  const candidats = (
    await Promise.all([
      paiementsRecus(db, maintenant),
      propositionsRecues(db, maintenant),
      relancesDiscord(db, maintenant),
      finsAccesProches(db, maintenant),
    ])
  ).flat();

  const bilan: Bilan = {
    candidats: candidats.length,
    envoyes: 0,
    echecs: 0,
    ignores: 0,
    erreurs: [],
  };
  if (candidats.length === 0) return bilan;

  const { data: profils, error } = await db
    .from('profiles')
    .select('id, email, prenom')
    .in('id', [...new Set(candidats.map((c) => c.userId))]);
  if (error) throw new Error(`profils : ${error.message}`);
  const parId = new Map((profils ?? []).map((p) => [p.id, p]));

  for (const c of candidats) {
    const profil = parId.get(c.userId);
    if (!profil?.email || !(await reserver(db, c, profil.email, maintenant))) {
      bilan.ignores++;
      continue;
    }

    const resultat = await envoyer(
      profil.email,
      c.construire(profil.prenom),
      cleIdempotence(c.modele, c.cle),
    );

    await db
      .from('emails_envoyes')
      .update(
        resultat.ok
          ? { statut: 'envoye', fournisseur_id: resultat.id, erreur: null }
          : { statut: 'echec', erreur: resultat.erreur },
      )
      .eq('modele', c.modele)
      .eq('cle', c.cle);

    if (resultat.ok) bilan.envoyes++;
    else {
      bilan.echecs++;
      bilan.erreurs.push(`${c.modele}:${c.cle} — ${resultat.erreur}`);
    }
  }

  return bilan;
}
