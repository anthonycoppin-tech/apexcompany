import { echapper, euros } from '../email/modeles.ts';
import { SOCIETE } from '../legal/societe.ts';

/**
 * La facture, en document HTML autonome et imprimable.
 *
 * **Générée à la demande, pas stockée.** `invoices.pdf_url` attendait un
 * fichier que rien ne produisait ; le client lisait « en préparation » pour
 * toujours. Tout ce qu'une facture affirme est déjà en base et n'en bouge
 * plus — numéro (séquence sans trou, posée par déclencheur), date d'émission,
 * montant de la commande —, donc la reconstruire à chaque lecture redonne le
 * même document. Le navigateur l'enregistre en PDF : pas de dépendance, pas de
 * stockage à sécuriser, pas de fichier qui diverge de la base.
 *
 * Une limite, assumée : l'identité du vendeur vient de `lib/legal/societe.ts`.
 * Le jour où l'adresse change, les anciennes factures la reprendraient. Il
 * faudra alors figer l'identité par facture — une migration, pas un oubli.
 *
 * Fonction pure, comme les emails : testable et sans accès à la base.
 */
export type DonneesFacture = {
  numero: string;
  emiseLe: string;
  client: { nom: string | null; email: string | null };
  produit: string;
  typeProduit: string;
  montantCents: number;
  devise: string;
  /**
   * La TVA calculée par Stripe Tax pour cet encaissement, incluse dans
   * `montantCents`. `null` : non calculée — un encaissement d'avant Stripe Tax,
   * ou une facture qu'on ne sait pas rattacher à son encaissement.
   */
  tva: { tvaCents: number; pays: string | null } | null;
};

const TYPES: Record<string, string> = {
  abonnement: 'Abonnement mensuel',
  accompagnement: 'Accompagnement',
  formation: 'Formation',
};

const dateLongue = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/**
 * Le taux affiché, déduit des montants : Stripe Tax donne la taxe, pas le
 * taux, et un taux change. Arrondi au dixième — 5 % aux Émirats.
 */
export function tauxAffiche(ttcCents: number, tvaCents: number): string {
  const htCents = ttcCents - tvaCents;
  if (tvaCents <= 0 || htCents <= 0) return '0';
  return String(Math.round((tvaCents * 1000) / htCents) / 10).replace('.', ',');
}

export function factureHtml(d: DonneesFacture): string {
  const e = echapper;
  const m = (c: number) => e(euros(c, d.devise));
  const libelle = `${TYPES[d.typeProduit] ?? 'Programme'} — ${d.produit}`;

  const lignesTva = d.tva
    ? `<tr><td>Total HT</td><td class="n">${m(d.montantCents - d.tva.tvaCents)}</td></tr>
<tr><td>TVA ${e(tauxAffiche(d.montantCents, d.tva.tvaCents))} %</td><td class="n">${m(d.tva.tvaCents)}</td></tr>`
    : '';
  const pays = d.tva?.pays ? ` (${e(d.tva.pays)})` : '';
  const mentionTva = !d.tva
    ? `<p class="attente">TVA non calculée pour cet encaissement, antérieur au calcul automatique.</p>`
    : d.tva.tvaCents > 0
      ? `<p class="petit">TVA des Émirats arabes unis, calculée selon le pays du client${pays} et incluse dans le prix payé.</p>`
      : `<p class="petit">Aucune TVA n’est facturée pour ce client${pays}.</p>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Facture ${e(d.numero)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:0;background:#f5f5f4}
  main{max-width:720px;margin:24px auto;background:#fff;padding:40px;border-radius:12px}
  h1{font-size:22px;margin:0 0 4px} h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin:0 0 6px}
  .entete{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:32px}
  .bloc p{margin:0;line-height:1.5;font-size:14px}
  table{width:100%;border-collapse:collapse;margin:24px 0;font-size:14px}
  th,td{padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:left}
  .n{text-align:right;font-variant-numeric:tabular-nums}
  tfoot td{border:0;padding:6px 0} tfoot tr:last-child td{font-weight:bold;font-size:16px}
  .petit{font-size:12px;color:#6b7280;line-height:1.5}
  .attente{font-size:12px;color:#92400e;background:#fef3c7;padding:8px 10px;border-radius:6px}
  button{font:inherit;padding:10px 16px;border:0;border-radius:8px;background:#111827;color:#fff;cursor:pointer}
  @media print{body{background:#fff}main{margin:0;padding:0;border-radius:0}.ecran{display:none}}
</style>
</head>
<body>
<main>
<p class="ecran" style="text-align:right;margin:0 0 24px"><button onclick="window.print()">Imprimer ou enregistrer en PDF</button></p>
<div class="entete">
  <div class="bloc">
    <h1>Facture ${e(d.numero)}</h1>
    <p>Émise le ${e(dateLongue(d.emiseLe))}</p>
  </div>
  <div class="bloc">
    <h2>Vendeur</h2>
    <p><strong>${e(SOCIETE.raisonSociale)}</strong></p>
    <p>${e(SOCIETE.adresse)}</p>
    <p>Licence ${e(SOCIETE.licence)} — ${e(SOCIETE.zoneFranche)}</p>
    <p>TRN ${e(SOCIETE.trn)}</p>
    <p>${e(SOCIETE.email)}</p>
  </div>
</div>
<div class="bloc">
  <h2>Client</h2>
  ${d.client.nom ? `<p><strong>${e(d.client.nom)}</strong></p>` : ''}
  ${d.client.email ? `<p>${e(d.client.email)}</p>` : ''}
</div>
<table>
  <thead><tr><th>Désignation</th><th class="n">Montant TTC</th></tr></thead>
  <tbody><tr><td>${e(libelle)}</td><td class="n">${m(d.montantCents)}</td></tr></tbody>
  <tfoot>
    ${lignesTva}
    <tr><td>Total TTC payé</td><td class="n">${m(d.montantCents)}</td></tr>
  </tfoot>
</table>
<p class="petit">Payé par carte bancaire via Stripe. Aucun montant ne reste dû.</p>
${mentionTva}
<p class="petit">Prestation exclusivement éducative, sans conseil en investissement. Conditions générales de vente : article 8 pour la rétractation.</p>
</main>
</body>
</html>`;
}
