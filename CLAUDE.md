# ApexCompany — plateforme

Monorepo npm workspaces. Next.js 16 (App Router) + Supabase + TypeScript.
La spécification fonctionnelle fait foi et vit dans [`docs/`](docs/) :
`01-CAHIER-DES-CHARGES.md` (parcours client, rôles, écrans — **à lire en premier**),
`02-SITEMAP.md` (arborescence et matrice d'accès), `04-DATA-MODEL.md` (schéma et RLS),
`06-PERIMETRE.md` (ce qu'on construit et ce qu'on ne construit pas),
`07-REPARTITION.md` (qui possède quoi entre les deux développeurs),
`08-CE-QUI-MANQUE.md` (**tout ce que le code attend de l'extérieur** : clés, informations
juridiques, contenu — à donner au client, pas à un développeur),
`09-CHANTIERS.md` (**qui travaille sur quoi — à lire et à mettre à jour avant de commencer**).
`10-MISE-EN-PRODUCTION.md` (la procédure du jour J, pas encore exécutée).

**Avant de coder quoi que ce soit : ouvrir `09-CHANTIERS.md`, prendre un sujet, committer la
prise et la pousser.** Le verrou est Git, pas l'intention : une prise gardée en local ne
protège de rien. Ce fichier remplace le découpage par couche de `07-REPARTITION.md` — personne
n'est limité à un périmètre, on se répartit par sujet.

**Les quatre documents sont à la révision 3** (8 septembre 2026) : tunnel inversé, trois
types de produit, disparition des cohortes et des replays, espace formateur dédié.
`01-CAHIER-DES-CHARGES.md` porte le raisonnement, les autres en tirent les conséquences.

## Point d'étape — 23 septembre 2026

**Prime sur tous les points d'étape ci-dessous**, qui restent vrais pour ce que celui-ci ne
contredit pas.

Le client a livré trois choses le même jour : une bannière qui arrête la charte graphique, un
document de seize liens de paiement **Whop**, et la décision de quitter Stripe.

### Whop encaisse, mais n'ouvre aucun accès

**C'est l'arbitrage central de la journée, et il vaut d'être compris avant de toucher au
paiement.** Whop sait attribuer les rôles Discord — c'est son produit d'origine, et c'est même
ce pour quoi la plupart des gens l'utilisent. **On ne s'en sert pas.** L'accès reste piloté par
`inscriptions.date_fin_acces` et la file `discord_sync_queue` ; Whop n'est qu'un encaisseur.

Déléguer l'accès au prestataire, c'est perdre la révocation en fin d'accès, la prolongation au
rachat et la réconciliation — trois mécaniques déjà écrites et prouvées. Le bénéfice s'est
présenté tout de suite : le paramètre de résiliation de `/memberships/{id}/cancel` n'est pas
documenté, et **même si Whop éteignait l'adhésion sur-le-champ au lieu de la fin de période, le
client ne perdrait rien**, parce que son accès ne dépend pas de cet état.

**Rien n'a changé dans la couche métier**, et c'est ce qui a rendu la bascule raisonnable :
l'énumération `payment_provider` existait, les cinq fonctions du chemin de l'argent prennent
`p_provider` en paramètre et `p_references text[]`. **Aucune signature SQL n'a bougé.** Une
migration d'une ligne pour l'énumération, une pour le filet de rattrapage, une pour le catalogue.

### Trois pièges qui valaient chacun un fichier testé

- **Whop parle en décimales, tout notre modèle est en centimes entiers.**
  `parseFloat('19.99') * 100` vaut 1998.9999999999998 ; `Math.round` le rattrape à cette
  échelle, et c'est exactement ce qui rend le défaut invisible — il ne se manifeste pas sur les
  montants qu'on essaie à la main. `lib/paiement/montants-whop.ts` ne passe jamais par le
  flottant : il lit la chaîne décimale et assemble des entiers. Un montant illisible rend
  `null`, jamais zéro — même règle que la TVA depuis le 22 septembre.
- **La signature suit « Standard Webhooks »**, pas le format Stripe : elle porte sur
  `{webhook-id}.{webhook-timestamp}.{corps brut}`, la clé est le secret **tel quel, préfixe
  `ws_` compris** (Whop demande explicitement de ne pas le décoder), et l'horodatage se vérifie
  chez nous — **c'est notre seule protection contre le rejeu**, le SDK de Stripe l'assurait.
- **Premier paiement et renouvellement arrivent sous le même événement**, `payment.succeeded`.
  On les distingue par l'état de la base, pas par une chaîne dont la documentation ne donne pas
  les valeurs. Se tromper offrirait un mois de plus à chaque souscription.

### Ce qui n'a pas tourné, et c'est la réserve principale

**Rien du chemin de l'argent n'a été exécuté contre le vrai service.** La différence avec la
réserve que Stripe portait depuis le 8 septembre, c'est que **les clés existent** : le bac à
sable lève tout ça en une heure. Trois points à y vérifier, listés dans
`docs/08-CE-QUI-MANQUE.md` :

1. **la clé d'idempotence des remboursements** — Stripe la garantissait par contrat, la
   documentation de Whop la mentionne dans un exemple de SDK sans la décrire. On l'envoie sans
   pouvoir s'y fier. **C'est le seul risque de la bascule qui coûte de l'argent réel** ;
2. **le paramètre de résiliation** (voir plus haut — sans conséquence pour le client) ;
3. **la forme exacte des montants**, que la documentation décrit comme des objets sans en
   donner la clé.

### Le mode fiscal est tranché, et il a un prix qu'il faut dire

**« Whop collecte et reverse » (2 %)**, décidé faute de recul côté client. C'est le seul des
trois modes qui n'oblige pas APEX COMPANY — société de Dubaï vendant du service numérique à des
consommateurs de l'Union — à s'immatriculer elle-même au guichet unique non-Union et à déposer
les déclarations. Le mode à 0 % n'est moins cher que si quelqu'un fait ce travail, et personne
ne le fait.

**La conséquence n'est pas réglée** : dans ce mode, Whop devient _merchant of record_ et c'est
lui qui émet la facture fiscale, alors que les six pages légales du 21 septembre désignent
APEX COMPANY comme vendeur et émetteur. Elles n'ont jamais été relues par un juriste ; la
question s'ajoute à sa liste. **Le code ne parie sur aucun mode** : il écrit la TVA que Whop
rapporte, et `null` quand il n'en rapporte pas.

### Les seize liens sont déjà partis, d'où un filet

Un lien de paiement envoyé en message privé ne se rappelle pas. Les encaissements qui arrivent
par là n'ont **aucune métadonnée** : ni compte, ni produit. Le webhook ne pouvait
qu'acquitter et journaliser, et le symptôme côté client aurait été « j'ai payé et je n'ai pas
accès », en silence.

`formations.whop_plan_id` reconnaît le produit, l'adresse de l'acheteur est relevée, et
**`/admin/paiements/rattrapage`** nomme chaque paiement avec ce qu'il faut pour trancher en
quelques secondes. **On n'ouvre jamais l'accès sur une ressemblance** — d'abord parce que ce
serait affirmer ce qu'on ne sait pas, ensuite parce qu'un paiement passé hors du site **n'a
aucune acceptation des CGV enregistrée**, et que la règle du 21 septembre est « pas de preuve,
pas de vente ». Le rattachement passe par `traiter_paiement()` avec l'identifiant de
l'événement d'origine : idempotent par construction. La file se vide d'elle-même — on écarte
les paiements qui ont déjà un encaissement, plutôt que de poser un drapeau qu'on oubliera.

### Le catalogue : huit produits sur seize

PALACE 1/2/3, MATRIX 3.0, APEX BLACK, APEX PARTNER (et sa formule lancement) et APEX PRIME
mensuel entrent dans le modèle sans rien changer. **Ils arrivent en brouillon** : la base refuse
un produit publié sans `discord_role_id`, et c'est voulu — il encaisserait un paiement sans
ouvrir d'accès. Les rôles sont réclamés au client.

**Quatre choses ne rentrent pas, et chacune demande une migration** — détaillées en tête de
`20260923120000_a_catalogue_septembre.sql` : le **paiement en 2 fois** (supprimé le
8 septembre, et `traiter_paiement()` ouvre l'accès complet dès le premier encaissement),
l'**acompte de 150 €** (aucun avoir, aucun lien entre deux commandes), **APEX MASTERY** — un
séminaire physique daté avec jauge, sans table d'événements — et **APEX PRIME annuel** (`+ 30`
est en dur dans les deux fonctions SQL). Elles continuent de se vendre par leur lien Whop et
passent par le filet ci-dessus.

**APEX MASTERY est hors périmètre**, tranché par le client le 23 septembre : **pas d'événements
sur le site.** La plateforme ne gère aucune réservation de place — ce que `02-SITEMAP.md` actait
déjà et ce que `/evenements` affiche. Ce n'est donc pas un chantier en attente, et il ne se
rouvre que sur une nouvelle décision.

### La charte : le pari de `globals.css` a tenu

Couleurs **échantillonnées dans le PNG de la bannière**, pas relevées à l'œil : `#030944` →
`#111bcc` → `#3416e8` → `#9201cf`. Les noms de tokens n'ont pas changé, donc **les 109 écrans
se sont repeints sans être touchés**, et il ne reste aucune trace de l'ancienne palette dans le
CSS produit.

Le vrai travail était ailleurs, et c'est la leçon à retenir pour la prochaine charte :

- **`accent-contraste` s'inverse.** En thème clair, `bg-accent` était foncé et portait du
  blanc ; l'accent est clair maintenant et porte du sombre. Les neuf emplacements ont été
  vérifiés un par un — un seul usage posé sur fond sombre l'aurait rendu invisible.
- **Dix-sept `text-white` posés sur des aplats de token** deviennent `text-fond`, dont le motif
  `bg-encre text-white` des onglets de filtre répété dans six écrans. L'inversion est vraie dans
  les deux thèmes par construction ; la valeur littérale ne l'était que dans un.
- **Archivo remplace Manrope parce qu'elle a une vraie italique.** Manrope n'était chargée qu'en
  romain : le navigateur aurait penché les lettres sans les redessiner, ce qui se voit
  immédiatement sur des capitales grasses.
- **Le dégradé n'apparaît qu'à deux endroits** — le titre de l'accueil et la section communauté.
  Tout le texte posé dessus est en `encre` pleine : `encre-doux` tombe à 3,4:1 sur le bout
  violet, illisible là où le fond l'est le plus.

`lib/email/modeles.ts` et `lib/facture/modele.ts` gardent leurs couleurs en dur, et c'est juste :
un client mail ne connaît pas les variables CSS, et une facture s'imprime.

### Ce qui attend, et de qui ça dépend

- ~~Trois migrations attendent un `db:push`.~~ **Appliquées le 23 septembre au soir**, et
  **vérifiées par le contenu** : énumération à `{stripe, paypal, whop}`, `formations.whop_plan_id`
  et son index uniques présents, huit produits rattachés à leur plan Whop.
  `npm run db:types:linked` redonne à l'identique le `database.types.ts` écrit à la main.
  Poussées par Christopher, comme les 21 et 22 — **la troisième fois, ce n'est plus une
  coïncidence** : quelqu'un d'autre pousse, et le verrou de `09-CHANTIERS.md` ne protège pas la
  base partagée.
- **Les rôles Discord des huit produits**, sans lesquels aucun ne peut être publié.
- **La relecture juridique**, avec le mode fiscal en main.
- **Le parcours de paiement dans le bac à sable Whop.**

## Point d'étape — 21 septembre 2026

**Prime sur tous les points d'étape ci-dessous**, qui restent vrais pour ce que celui-ci ne
contredit pas.

### Qui vend est tranché, et les pages légales sont écrites

**C'est APEX COMPANY L.L.C-FZ** (Meydan Free Zone, Dubaï, licence 2645781.01) : les six pages
légales de l'ancien site, transmises par le client, la désignent partout comme vendeur et
émettrice des factures. Son identité vit dans `apps/web/src/lib/legal/societe.ts` et **nulle
part ailleurs** — mentions légales, CGV, données structurées et pied des emails la lisent. **Sa
licence expire le 19 février 2027.**

Cinq pages sur six sont rédigées à partir de ces textes (`/accessibilite` attend un audit), plus
une nouvelle, **`/avertissement`** (l'ancien « disclaimer » et l'annexe « Risk Disclosure » des
CGV ; `/disclaimer` y redirige). Elles ne sont plus retirées de l'indexation. **Aucun juriste ne
les a relues.** Elles ne s'écartent des textes du client que là où ils étaient faux pour ce
site — la liste des écarts est dans `docs/08-CE-QUI-MANQUE.md` §2 et `/admin/legal`, dont un qui
compte : **la rétractation d'un accompagnement se fait au prorata** ; la formation et
l'abonnement la perdent à l'accès — un abonnement se résilie et ne se rembourse pas (22 septembre).

**Le défaut trouvé en chemin est de la même famille que tous les autres** : les CGV faisaient
accepter les conditions et renoncer à la rétractation « en cochant la case dédiée », et **aucun
des deux parcours de paiement n'avait de case**. Il y en a deux, requises, revérifiées par
l'action, et **enregistrées dans `consents` avant l'ouverture de Stripe** — pas de preuve, pas
de paiement (`lib/legal/acceptation.ts`). Aucune migration : le type `cgv` existait depuis le
7 septembre sans jamais servir. Toute modification des CGV change `VERSION_TEXTES_LEGAUX`.

**Fait le 22 septembre** : les factures (`/facture/[id]`, générées à la demande depuis la base,
imprimables en PDF), et le montant de rétractation d'un accompagnement calculé sur la fiche
client. Un remboursement lancé du back-office referme l'accès même partiel : il n'y avait rien
d'autre à construire. La conservation des clients est relâchée (effet en 2029, attend le
juriste — `docs/09-CHANTIERS.md`).

**La TVA passe par Stripe Tax** (tranché le 22 septembre : pas de TVA européenne). Chaque
paiement demande le calcul automatique, taxe incluse dans le prix affiché ; le webhook passe la
TVA et le pays à `traiter_paiement()` / `renouveler_abonnement()`, qui les écrivent sur
l'encaissement **dans la même transaction**, et la facture les lit par `invoices.payment_id`.
**Une TVA non calculée n'est jamais écrite comme une TVA nulle** (`lib/paiement/taxe-stripe.ts`).
**À savoir** : sans Stripe Tax activé dans le tableau de bord, aucun paiement ne s'ouvre. La
migration `20260922100000_a_tva_stripe_tax.sql` est appliquée sur la base partagée et vérifiée
par son contenu ; types régénérés, identiques.

**Piège de recette** : `next dev` répond 404 aux routes dynamiques imbriquées sur ce poste
(`/admin/clients/[id]`, `/admin/crm/leads/[id]`, `/formations/[slug]/souscrire`), sans rien
dans le journal. Ce n'est pas le code : un `next build` puis `next start` les sert. Recetter
sur un build de production.

### « Envoyé » ne voulait pas dire « reçu », et la page l'affirmait quand même

Même famille que les trois du 13 septembre : **une page qui affirme ce qu'elle ne sait pas.**
`emails_envoyes.statut` s'arrêtait à `envoye`, qui veut seulement dire « Resend a accepté la
requête ». Une adresse morte, une boîte pleine ou un client qui clique sur « indésirable »
laissaient la ligne intacte — et `/admin/emails`, la page qu'on ouvre justement quand quelqu'un
dit n'avoir rien reçu, affichait « Envoyé ».

Le webhook `api/resend` pose trois états de plus : `livre`, `rebond`, `plainte`. Trois choses
valent d'être retenues :

- **`rebond` et `plainte` sont des états à part, pas un `echec` avec un message.** `echec` veut
  dire « on réessaie » dans `peutReprendre()` : y ranger un rebond relancerait trois fois une
  adresse qui n'existe pas, ce qui abîme la réputation du domaine expéditeur — donc la
  délivrabilité de tout le reste, **liens de connexion compris**, dont dépend tout le parcours
  d'achat.
- **L'ordre d'arrivée n'est pas garanti**, et une plainte arrive forcément après la livraison
  qui l'a provoquée. Un rang (`lib/email/rebonds.ts`) empêche un `livre` tardif d'effacer une
  plainte ; sans lui, le dernier arrivé gagnerait et la plainte disparaîtrait.
- **Un rebond hors registre est journalisé quand même.** Les emails de connexion partent par le
  SMTP de Supabase et n'ont pas de ligne ici, mais leurs rebonds arrivent sur ce webhook.
  Depuis le 17 septembre un client n'a pas de mot de passe : si son lien rebondit, il est
  dehors, et rien d'autre ne le signalerait.

Tant que `RESEND_WEBHOOK_SECRET` manque, **`/admin/emails` le dit** plutôt que de laisser lire
« Envoyé » comme « arrivé » — le même garde-fou que les chiffres de l'accueil.

### DMARC n'était nulle part, et c'est un manque côté client

Ni dans les docs ni dans le code. Or **Resend ne le réclame pas** : le domaine s'affiche
« vérifié » sans lui, les emails partent, et ils se font filtrer — Gmail et Yahoo l'exigent
depuis 2024, y compris pour du transactionnel. Il est maintenant dans `08-CE-QUI-MANQUE.md` et
dans la procédure de mise en production, avec la précision qui fait perdre une heure à tout le
monde : **les quatre enregistrements DNS se créent chez le fournisseur du domaine, jamais chez
Resend**, qui se contente d'afficher les trois premiers et de vérifier qu'ils existent.

### Plus aucune migration en attente, et une leçon sur la base partagée

Les 30 migrations du dépôt sont appliquées sur la base hébergée, et `db:types:linked` redonne un
`database.types.ts` identique. Les deux qui attendaient — celle du 18 septembre et
`20260921100000_a_rebonds_emails.sql` — **ont été poussées par l'autre développeur dans la
demi-heure**, sans commit : un `db:push` n'en produit aucun. Le verrou de `09-CHANTIERS.md`
protège du travail fait deux fois, **pas de la base partagée**.

**Et une chose à savoir avant de s'y fier** : `supabase migration list --linked` compare par
**numéro de version, jamais par contenu**. Deux fichiers différents portant le même horodatage
passent pour la même migration, et `db push` saute le second **silencieusement, pour toujours** —
il répond « up to date ». Le contrôle qui ne ment pas est de lire ce que la base dit d'elle-même :
les `comment on table` / `comment on column` ressortent dans l'OpenAPI de PostgREST
(`GET /rest/v1/`, `Accept: application/openapi+json`) et les fonctions en `/rpc/<nom>`. Deux
lectures seules, sans Docker — c'est ce qui a permis de trancher ici.

### Branches nettoyées

Il ne reste que `main`. `claude/systeme-de-messages` était fusionnée par la PR #20,
`claude/confident-newton-2w22x1` entièrement dans `main`, et `claude/quirky-goldberg-v91bjn`
portait un vouvoiement que le chantier du 16 septembre avait déjà refait.

## Point d'étape — 18 septembre 2026

**Reste vrai pour tout ce que le point d'étape du 21 septembre ne contredit pas.**

- **Une migration attend un `db:push`** : `20260918100000_a_litiges_et_remboursements_stripe.sql`,
  non appliquée faute d'avoir pu prévenir l'autre développeur. Types ajoutés à la main dans
  `packages/db` ; détail en tête de `docs/09-CHANTIERS.md`.
- **Les renouvellements d'abonnement n'étaient pas enregistrés** comme encaissements : absents du
  chiffre d'affaires, des exports et des factures. Corrigé, et `renouveler_abonnement()` a enfin
  des tests — l'affirmation plus bas qu'elle était testée pour l'idempotence était fausse.
- **Stripe : litiges et remboursements faits hors du site** sont reçus par le webhook. Un
  remboursement d'abonnement depuis le back-office échouait toujours ; corrigé.
- **Un abonné en impayé peut changer sa carte** depuis `/espace/factures` (portail Stripe).
- **Le réseau d'origine arrive jusqu'au formulaire**, par l'adresse et sans cookie : les
  statistiques par réseau étaient `direct` à 100 % pour le parcours prévu.
- **Emails transactionnels écrits** (tâche horaire, `/admin/emails`), jamais envoyés : attendent
  un compte Resend.
- **Pages d'erreur en français, en-têtes de sécurité, anti-spam du formulaire** (champ piège et
  vingt comptes par heure et par adresse). **La procédure de mise en production est écrite**
  (`docs/10-MISE-EN-PRODUCTION.md`), et a fait trouver une adresse de retour Discord manquante.
- **Relecture du projet le 18 septembre** : les manques trouvés sont dans les sujets libres de
  `docs/09-CHANTIERS.md`.

## Point d'étape — 17 septembre 2026

**Prime sur tous les points d'étape ci-dessous**, qui restent vrais pour ce que celui-ci ne
contredit pas.

- **La base partagée porte enfin les données de la révision 3.** Rechargée le 17 septembre, en
  gardant tout le montage Discord de Christopher (liaisons, file, journaux, vrais rôles du
  catalogue). Les écrans formateur, client et back-office ont été vus **remplis** pour la première
  fois. Ce qui diffère du seed est écrit en tête de `docs/09-CHANTIERS.md`. Toutes les mentions
  « la base porte les données de la révision 2 » plus bas sont donc périmées.
- **Relier un autre compte Discord redemande tous les rôles dus** (`invité` et ceux des
  inscriptions actives). L'ancien compte garde les siens : le worker ne vise que le compte relié,
  et le retrait est manuel, tracé dans `/admin/logs`.
- **Les clients se connectent par email, sans mot de passe.** `/connexion` envoie un lien et un
  code ; l'équipe garde son mot de passe. C'était le seul moyen de revenir pour un compte créé par
  le formulaire, qui n'a pas de mot de passe. Les modèles d'email sont dans
  `supabase/templates/` et se posent par `npm run auth:modeles` — **refusé sur un projet gratuit sans
  SMTP**, donc en attente du plan Pro ou d'un service d'envoi (`docs/08-CE-QUI-MANQUE.md`).
- **Un accès payé est confié au formateur de la proposition** (migration `20260917100000`,
  appliquée) : sans cela, aucun formateur ne voyait jamais un client réel. Le back-office permet
  d'en désigner un autre, accès par accès, depuis la fiche client.
- **L'espace formateur couvre l'après-vente.** `/formateur/accompagnements` part de
  `inscriptions.formateur_id` (les clients confiés, vendus ou non) et porte le carnet de suivi ;
  les notes marquées visibles s'affichent dans `/espace`. Tableau de bord, rendez-vous et
  statistiques (ventes au montant proposé) repris avec les données rechargées.
- **`/admin/statistiques`** donne toute l'activité, argent compris : encaissé et net, abonnements,
  tunnel, réseaux jusqu'à l'encaissé, comparaison des formateurs.
- **On ne paie plus deux fois le même accès**, et un rachat d'accompagnement prolonge l'accès au
  lieu de le raccourcir (migration `20260917110000`, appliquée). Vus à l'écran avec données :
  l'espace client et tout le back-office.
- **Les demandes RGPD se traitent depuis la fiche prospect** : copie des données en JSON, et
  effacement en deux temps par `effacer_personne()` (migration `20260917120000`, appliquée), qui
  refuse toute personne ayant une trace d'achat.
- **Emails transactionnels : écrits (18 septembre), jamais envoyés.** Tâche horaire `api/cron/emails`
  qui part de l'état de la base, registre `emails_envoyes`, `/admin/emails`. Attend un compte Resend.
- **`/admin/exports`** sort paiements, remboursements, factures et prospects en CSV pour Excel.
- **`apps/web` a des tests** : `npm test`, runner intégré de Node, lancé par la CI.
  `lib/messages/catalogue.test.ts` garde la règle « un code dépendant sans preuve ne rend rien » ;
  35 tests en tout, règles du formateur et exports compris.

## Point d'étape — 15 septembre 2026

**Prime sur tous les points d'étape ci-dessous**, qui restent vrais pour ce que celui-ci ne
contredit pas.

### Deux choses à savoir avant de toucher quoi que ce soit

**1. Les comptes formateur du seed ont été renommés sur la base hébergée.** Si tu te connectes
avec `coach.a@apex.test` ou `coach.b@apex.test`, ça ne marche plus : c'est désormais
`formateur.a@apex.test` et `formateur.b@apex.test`, mot de passe inchangé (`password123`).
UUID, rôles et données liées n'ont pas bougé — seul l'email a changé, et `profiles.email` avec
lui.

Pourquoi ils étaient faux : ces comptes viennent du **seed**, pas d'une migration. Le renommage
`coach` → `formateur` du 8 septembre a donc corrigé l'énumération, les politiques RLS et
`user_roles`, mais pas `auth.users`. Personne ne pouvait se connecter en formateur avec les
identifiants documentés, et la CI ne le voyait pas — elle avait été alignée sur le seed le
9 septembre, la base hébergée jamais.

**La règle générale vaut d'être retenue : une migration corrige le schéma, jamais les données
du seed déjà posées sur la base hébergée.**

**2. ~~Une migration attend un `db:push`.~~ Plus vrai au 16 septembre** :
`20260915100000_a_audit_suppression.sql` est appliquée sur la base hébergée
(`npx supabase migration list --linked`), comme `20260916120000_a_purge_prospects.sql` depuis.
Dépôt et base sont alignés.

### Ce qui a été livré

- **Recette à l'écran.** Les 56 écrans passés avec une vraie session de chaque rôle, depuis un
  poste qui atteint `supabase.co`. **Les gardes de layout sont vérifiées et justes** — c'est la
  case restée ouverte depuis le 8 septembre, elle est fermée. `admin` est bien refusé sur
  `/admin/audit` et `/admin/parametres` pendant qu'`owner` passe ; `/espace` refuse le staff ;
  `/formateur` refuse tout le monde sauf un formateur. Aucun écran ne plante, et les états vides
  sont rédigés partout, y compris sur les écrans de `(espace)`, `(formateur)`, `/admin/contenu`
  et `/admin/legal` qui n'avaient jamais été affichés.
- **`/evenements` ne ment plus.** Elle publiait « Placeholder — écran à construire. Voir
  docs/02-SITEMAP.md » à tout visiteur. C'est le défaut corrigé le 13 septembre sur les six
  pages légales, resté là parce que cette page n'est pas juridique — alors qu'elle est publique
  exactement de la même façon. Elle dit maintenant ce qu'elle contiendra, sans rien inventer
  au-delà de ce que `02-SITEMAP.md` tranche déjà, et se retire de l'indexation.
- **Supprimer du contenu publié laisse une trace.** `trace_audit()` savait déjà tout faire pour
  un DELETE ; seuls les déclencheurs ne l'appelaient pas. Un témoignage porte le nom d'une
  personne réelle et ses mots, publiés avec son accord : le supprimer effaçait la seule preuve
  de cet accord — celle qu'on veut produire le jour où elle conteste, c'est-à-dire le jour où la
  ligne n'existe plus. `formations` est dans la même migration, même trou hérité de
  `audit_offres`. `audit_refunds` reste dehors, volontairement : depuis le 16 septembre, un
  remboursement ne peut tout simplement plus être supprimé (`20260916140000`).

### Ce que la recette a surtout montré, et qui n'est pas tranché

**Personne ne peut voir un écran plein.** La base de dev partagée porte encore les données de
la révision 2, et c'est plus large que le catalogue : `inscriptions.formateur_id` est NULL sur
les deux inscriptions, il n'y a aucune proposition, aucun témoignage et aucune fiche formateur.
Le seed du dépôt remplit tout cela (`seed.sql` lignes 282 et 316) — il n'a jamais été rejoué
depuis la révision 3.

Les quatre écrans formateur sont donc vides parce qu'aucun formateur n'a de client, pas parce
qu'ils sont cassés. Idem pour les écrans du contenu éditorial livrés le 13 septembre.

**Ça ne se décide pas seul** : rejouer le seed écrase ce qui a été saisi à la main sur une base
que deux personnes partagent. C'est le conflit de `07-REPARTITION.md`, et l'argument le plus
concret entendu jusqu'ici pour le branching du plan Pro.

### Comment refaire la recette

Il n'y a pas de navigateur installé sur les postes, et le proxy d'entreprise rend un
téléchargement de Chromium incertain. La recette a donc été faite en HTTP : les cookies de
session sont produits par `@supabase/ssr` lui-même — un `createServerClient` avec un magasin de
cookies en mémoire, un `signInWithPassword`, puis on relit le magasin — plutôt que forgés à la
main, ce qui les rend exacts par construction. Ensuite un `fetch` par route, en
`redirect: 'manual'` pour lire les gardes, et une extraction du texte visible pour juger le
rendu.

**Un piège à connaître si tu refais ça** : React insère des commentaires entre les segments de
texte en SSR. Une extraction naïve qui remplace les balises par des espaces fait apparaître de
faux « mots manquants » — un `Compte connecté{nom}.` correct se lit « Compte connecté . » et
ressemble à un bug qui n'existe pas.

## Point d'étape — 13 septembre 2026

**Prime sur tous les points d'étape ci-dessous**, qui restent vrais pour ce que celui-ci ne
contredit pas. Deux personnes ont travaillé en parallèle toute la journée, sur des sujets
pris dans `docs/09-CHANTIERS.md` — le mécanisme a tenu, aucun conflit.

### Le site ne ment plus nulle part

Trois choses, trouvées le même jour et de la même famille : **une page qui affirme ce qui
n'est pas.**

- **Un brouillon pouvait ouvrir un paiement réel.** `/formations/[slug]/souscrire` ne filtrait
  pas `actif`. Un membre du staff connecté — et lui seul, la page étant introuvable pour un
  visiteur — pouvait déclencher un abonnement Stripe sur un produit non publié. La cause est
  générale et vaut d'être retenue : **les politiques RLS d'une même commande se combinent en
  OU**, donc « la RLS ne laisse voir que les produits actifs » est faux dès qu'une seconde
  politique ouvre la table au staff. Plusieurs commentaires du dépôt l'affirmaient ; ils
  étaient faux. Les pages publiques filtrent désormais explicitement.
- **Les six pages légales affichaient « Placeholder — écran à construire. Voir
  docs/02-SITEMAP.md »**, publiquement. `/confidentialite` est liée depuis trois formulaires,
  dont celui de qualification, qui fait accepter un consentement « dans les conditions décrites
  par la politique de confidentialité ». Elles disent maintenant ce qu'elles contiendront,
  renvoient vers le contact, et **se retirent de l'indexation** tant qu'elles sont dans cet
  état — `robots.txt` interdit déjà tout faute de domaine HTTPS, mais il ouvrira le jour de la
  mise en ligne. **Rien de juridique n'a été rédigé** : ni l'identité de la société qui vend,
  ni le régime de TVA ne sont connus, et un modèle recopié engagerait sur des clauses que
  personne n'a lues. Ce qui est déjà vrai est dit — ce que le code collecte, les services
  traversés, l'absence totale de traceur.
- **L'aide d'exploitation ne peut pas se périmer** : `/admin/aide`, rangée par symptôme (« j'ai
  payé et je n'ai pas accès ») et non par mécanisme, lit ses quatre indicateurs en base plutôt
  que de les affirmer.

C'est le même garde-fou que les trois du 9 septembre : rendre l'état faux impossible plutôt
que compter sur la vigilance.

### Le système de messages, et la règle qui le tient

**Une URL transporte un accent, jamais une proposition.** Ce qui est affirmé vient des données
que la page a chargées. Le test qui range chaque code : _si un inconnu tape cette URL sur une
page où rien ne s'est passé, ce qu'il lit est-il encore vrai ?_

Il y avait **cinq** mécaniques, pas trois — le `useState` de `/connexion`, quatorze types d'état
de `useActionState` sous **trois formes incompatibles**, quatre conventions de paramètre d'URL,
un bloc serveur forgeable, et de la validation de champ en ligne. Il en reste une :
`lib/messages/` et `components/message.tsx`. Le composant **dérive le rôle ARIA du ton** — on ne
peut plus écrire un message muet.

Le catalogue `?m=` a deux familles. Les **constantes** restent vraies même forgées
(« Paiement interrompu — rien n'a été débité » l'est pour qui n'a rien payé). Les
**dépendantes** exigent une `Preuve` — un type marqué, infabricable hors de `preuves.ts`, et
**borné à dix minutes** : l'URL dit qu'un événement a eu lieu, la base dit qu'un tel événement
a eu lieu récemment pour ce compte, et il faut les deux. Sans preuve, pas de message dégradé :
**pas de message**.

**Trois défauts trouvés en faisant l'inventaire**, tous du même genre que ce qui a motivé le
chantier :

- `/qualification` redirigeait vers `/reserver?inscription=ok`, que `/reserver` **n'a jamais
  lu**. Le seul retour du tunnel qui dit « ton compte est créé » tombait dans le vide.
- `?paiement=ok` sur `/espace` et `?paiement=annule` sur `/souscrire` n'avaient **aucun rôle
  ARIA**. Le message le plus important du produit n'était pas annoncé.
- **L'insertion du `grant` dans `api/discord/callback` jetait son erreur.** Le `sans-role` du
  12 septembre ne bouchait qu'une branche : si l'insertion échouait, la page annonçait toujours
  « ton accès arrive dans la minute ». C'est l'argument qui a fait descendre la vérification
  dans les données plutôt que de la laisser dans le paramètre d'URL.

### Ce que la recette visuelle du 14 septembre a corrigé

**Le système a été repris à l'écran, écran par écran, et sept défauts en sont sortis.** Aucun
n'aurait été vu au typecheck — c'est l'argument, une fois de plus, pour regarder les choses
tourner.

- **`/connexion` répondait en anglais.** On passait `error.message` de GoTrue tel quel, sur un
  site français, avec un texte qui parle de son implémentation. C'est `error.code` qui est
  traduit désormais, et le message brut ne s'affiche plus jamais.
- **`MessageLigne` était un `<span>` inline**, donc sourd aux marges verticales : posé seul dans
  une pile `space-y-*`, il se collait au bouton suivant. `inline-block` le règle **partout**.
- **Tailwind v4 a retiré `cursor: pointer` des `<button>`.** « Se connecter » (un lien) prenait
  la main, « Se déconnecter » (un bouton) non — et vingt-deux boutons du site étaient dans ce
  cas. La règle est revenue dans `globals.css`, pas dans le composant de bouton : une classe à
  ne pas oublier finit par être oubliée.
- **`discord-echec` s'affichait en gris.** J'avais confondu la famille (constante) et le ton :
  une constante peut très bien être un échec. Il est en `alerte`, donc annoncé immédiatement.
- **React 19 réinitialise le formulaire après une action serveur.** Les boutons radio de
  `/qualification` sont contrôlés par l'état, et React ne réécrit `checked` que si la valeur a
  changé : après un échec, les réponses restaient en mémoire et disparaissaient de l'écran —
  puis la soumission suivante repartait avec des champs vides. Le consentement est désormais
  vérifié dans le navigateur (donc plus d'aller-retour, donc plus de réinitialisation), et les
  champs sont remontés après chaque action.
- **Supabase renvoie ses échecs de liaison dans le fragment** (`#error=...&error_code=
identity_already_exists`), **que le serveur ne voit jamais.** La route de rappel n'y voyait
  aucun `code` et concluait « annulé ». `MessageURL` lit le fragment côté navigateur, et **il
  l'emporte sur ce que le serveur a deviné** : il porte la raison du fournisseur, là où la route
  ne peut qu'inférer d'une absence.
- **La validation native ne dit rien dans `/admin/formations`** : sa bulle ne s'affiche pas
  quand le champ fautif est masqué, et la durée d'accès n'existe que pour un accompagnement. Le
  formulaire bloquait en silence. La contrainte HTML reste la source de vérité (`:invalid`),
  c'est l'affichage qui est à nous. Les champs obligatoires sont signalés.

**Vérifié contre le site qui tourne** : le ton `alerte` et son `role="alert"`, les constantes en
`info`, `compte-cree` en situation vraie et son effacement au rechargement, le succès en ligne,
et surtout **`/espace?m=paiement-recu` avec une vraie session ouverte n'affiche rien** — le cas
de l'URL forgée, qui est la raison d'être du système.

**Pas encore vus** : les deux rendus dépendants de `discord-lie`, qui demandent un compte Discord
jamais relié, et `paiement-recu` en positif, qui demande un encaissement réel — donc les clés
Stripe et un produit `abonnement`, que le catalogue de la base partagée n'a toujours pas.

### Ce qui a été livré

- **Discord — la réconciliation des rôles existe.** `npm run discord:reconcile` lit l'état réel
  du serveur, un GET par compte lié, et réempile ce qui manque. Elle n'accorde jamais qu'elle
  ne retire, ne touche que les rôles qu'elle gère, et a trouvé une divergence réelle du premier
  coup. Plus un bouton « Réattribuer les accès Discord » sur la fiche client.
- **Le contenu éditorial est branché de bout en bout** : back-office des témoignages et des
  fiches formateurs, `/formateurs` alimentée par les fiches, témoignages sur l'accueil et les
  fiches produit. Plus un **guide de contenu** (`/admin/contenu`) qui montre au client la forme
  attendue avec des exemples fictifs — **confinés au back-office**, jamais publics.
- **`/admin/legal`** porte l'inventaire des traitements de données, relevé table par table, et
  les questions à poser au juriste page par page. Ce n'est pas un registre RGPD, c'est ce qu'un
  juriste demande en premier. Il a fait apparaître deux manques que personne n'avait vus : rien
  ne purge un prospect qui n'achète jamais, et la colonne prévue pour l'adresse IP du
  consentement n'est jamais remplie.

### Ce qui reste, et qui est nouveau

- **Le déclencheur d'audit de `temoignages` et `formateurs_fiches` ne couvre que les
  modifications.** Supprimer un témoignage efface donc la seule trace de son consentement. La
  suppression se confirme désormais en deux temps, ce qui réduit le risque du geste sans
  réparer le déclencheur — **c'est une migration**, notée dans les sujets libres.
- **`/admin/contenu` et `/admin/legal` n'ont jamais été vus à l'écran.** Ils compilent et sont
  typés, c'est tout ce qu'on peut affirmer : l'environnement où ils ont été écrits n'atteint
  pas `supabase.co`. Même réserve que les écrans de `(espace)` et `(formateur)`.

### La réconciliation des rôles Discord existe, et elle est vérifiée

`npm run discord:reconcile` compare l'état **réel** de Discord — un `GET` par compte lié —
à ce que la base dit dû, et réempile ce qui manque. Trois garde-fous, dans l'ordre où ils
comptent :

- **elle ne touche que les rôles du site** (`invité` et les `formations.discord_role_id`).
  Un bot qui « remet l'état conforme » sans cette limite dépouille les modérateurs au premier
  passage ;
- **elle accorde, elle ne retire jamais.** Le retrait appartient à `revoquer_acces_expires()` ;
- **`reussi` ne vaut pas dédoublonnage** : un `grant` réussi hier et un rôle absent
  aujourd'hui, c'est exactement le membre parti et revenu.

**Vérifiée le 13 septembre**, sur les deux chemins. Quitter un serveur Discord et y revenir
efface bien tous les rôles — constaté avec un second compte, là où ce n'était qu'une
supposition. Et le rattrapage prend quatre secondes, détection comprise.

Elle a trouvé une divergence réelle au premier passage : une inscription active sans son rôle,
séquelle du test de révocation de la veille.

**Pas de migration** : c'est de la logique de worker, comme `reclamerLot()`. Rien à pousser
sur la base partagée.

### Deux écrans pour que les pannes se voient

**`/admin/aide`** — des runbooks rangés par **symptôme** (« j'ai payé et je n'ai pas accès »),
pas par mécanisme : personne n'arrive là en connaissant le mot « réconciliation ». Et **ce qui
peut être mesuré n'y est jamais affirmé** : les quatre indicateurs sont lus en base à
l'affichage. Une aide qui écrirait « la réconciliation tourne tous les jours » deviendrait
fausse sans que personne ne le voie, et une aide à laquelle on se fie et qui ment est pire
qu'une aide absente.

**« Demande quelqu'un »** sur `/admin`, juste avant les incidents — une file qui **nomme des
personnes** au lieu de les compter, chaque ligne menant à la fiche du client où le bouton
« Réattribuer les accès Discord » existe. Trois cas, tous constatés, aucun anticipé.

Écarté au passage : le récap hebdomadaire par email. Il aurait échoué comme `/admin/logs`
échoue, avec trois semaines de retard, dans un filtre.

### Une règle qu'on s'impose pour ces deux écrans

**Une entrée ne naît que d'un incident réellement survenu.** Anticiper les pannes produit des
pages que personne ne relit et que rien ne vérifie — c'est ce qui pourrit une documentation.

### Tranché

**`MembreIntrouvable` répété** : relance par email 2 jours après l'ouverture de l'accès, action
humaine au bout d'une semaine. Deux prérequis manquent et figurent désormais dans
`08-CE-QUI-MANQUE.md` — **aucun envoi d'emails n'existe dans le projet**, et **aucun lien
d'invitation au serveur n'est configuré** : même avec les emails, une relance ne saurait pas
où envoyer la personne.

### Ce qui reste côté Discord, et de qui ça dépend

Rien qui dépende d'un développeur seul. Le serveur de production attend un accès
administrateur ; la planification de la réconciliation et de la révocation attend de savoir
où le site est hébergé ; **les salons attendent trois décisions**, consignées dans
`09-CHANTIERS.md` — sans eux, un client reçoit son rôle et ne voit rien de nouveau.

## Point d'étape — 12 septembre 2026 (soir)

**Reste vrai pour tout ce que le point d'étape du 13 septembre ne contredit pas.**

### Discord fonctionne — pour de vrai, et pour la première fois

L'aller-retour complet a eu lieu contre un vrai serveur Discord : liaison d'un compte,
attribution du rôle `invité`, attribution d'un rôle de produit, puis révocation par la
**chaîne métier entière** — inscription expirée, `revoquer_acces_expires()`, file, worker,
rôle retiré du membre. `automation_logs` en porte la trace.

C'était sur un **serveur de test**, dont le développeur est propriétaire. La production attend
un accès administrateur. Ce qui s'y rejoue (inviter le bot, créer les rôles, replacer la
hiérarchie) et ce qui ne se refait pas (l'application, le jeton, les réglages Supabase) est
écrit dans `apps/bot/README.md`.

**Le bot s'appelle `Apex`.** Aucun nom n'était fixé nulle part avant.

**Trois défauts trouvés, qu'aucun test hors ligne ne pouvait voir** — c'est l'argument pour
faire tourner les choses en vrai tôt :

- `X-Audit-Log-Reason` portait un **tiret cadratin**. Une valeur d'en-tête HTTP est une
  ByteString : `fetch` levait avant d'ouvrir la connexion. **Le worker n'avait jamais pu
  passer un seul appel**, et l'erreur ne parlait ni de Discord, ni de rôles, ni de
  permissions.
- `DISCORD_ROLE_INVITE_ID` était absente de `apps/web/.env.local` — c'est le **site** qui
  empile le rôle à la liaison, pas le worker. Le `grant` n'était jamais créé, et la page
  annonçait quand même « ton accès arrive dans la minute ».
- Le diagnostic lisait l'appartenance du bot par `/members/@me`, une route OAuth2 utilisateur
  qui répond 404 à un jeton de bot.

**Deux réglages à connaître, parce qu'ils bloquent tout en silence** : « Enable Manual
Linking » côté Supabase (désactivé par défaut, sans quoi `linkIdentity()` échoue) et la
hiérarchie des rôles Discord (un rôle au-dessus du bot = 403 à chaque attribution).
`npm run discord:check` vérifie le second sans rien modifier.

**L'identifiant et le secret de l'application Discord ne vont dans aucun fichier du dépôt** :
ils se saisissent dans le tableau de bord Supabase. Les lignes de `.env.example` ne servent
qu'à une instance Supabase locale, qui ne tourne pas ici.

### La connexion menait les comptes du staff dans le mur

Se connecter avec `owner` ou `admin` poussait vers `/espace`, dont la garde n'admet que le
rôle `client` — que le seed retire justement aux comptes internes. On rebondissait vers `/`,
où le header, **entièrement statique**, affichait « Se connecter ». Session ouverte, écran de
visiteur anonyme.

Corrigé : redirection par rôle (`destinationApresConnexion()`, partagée pour que header et
page de connexion ne divergent pas), header qui lit la session, et **une déconnexion, qui
n'existait nulle part dans l'application**.

« Faire le point » disparaît une fois connecté — et l'action de `/qualification` refuse
désormais une session existante : elle se terminait par un `verifyOtp` qui **remplace le
cookie de session**, donc un membre de l'équipe y perdait silencieusement son back-office.
`/qualification` et `/connexion` renvoient les comptes connectés vers leur espace.

`EtatSession` lit la session **dans le navigateur** : un `cookies()` dans le layout public
rendrait dynamiques toutes les pages publiques et déferait leur génération statique, donc le
travail de référencement. Vérifié au build.

### Ce qui reste, et qui est nouveau

- **La réconciliation des rôles Discord** — écrite et **vérifiée contre un vrai serveur le
  13 septembre** : `npm run discord:reconcile` détecte les rôles manquants et les réempile,
  quatre secondes de bout en bout. Le départ-retour, qui en était la prémisse, a été constaté
  avec un second compte — quitter et revenir efface bien tous les rôles. **Reste à la
  planifier** : rien ne l'appelle encore.
- **Où tourne le worker en production** : c'est un processus long, pas une route HTTP. Même
  question ouverte que le planificateur de la révocation quotidienne.

### Deux détails qui font perdre du temps

- **`SUPABASE_SERVICE_ROLE_KEY` est renseignée** et lit la base hébergée.
  `docs/08-CE-QUI-MANQUE.md` la donnait pour vide, c'est corrigé.
- **Le catalogue de la base hébergée porte enfin de vrais rôles Discord** pour les deux
  produits actifs. Le reste de ses données est toujours celui de la révision 2.

## Point d'étape — 9 septembre 2026

Ce qui a changé depuis la veille. **Prime sur le point d'étape du 8 septembre ci-dessous**,
qui reste vrai pour tout ce que celui-ci ne contredit pas.

- **La CI de `main` était rouge depuis le renommage `coach` → `formateur`**, et ça n'avait
  été vu par personne : l'étape de connexion réelle demandait `coach.a@apex.test`, absent du
  seed depuis. Réparée. Elle est verte, et le compte du seed est `formateur.a@apex.test`.
- **`npm run db:check` : 78 vérifications, 0 échec. pgTAP : 4 fichiers, 78 tests, 0 échec.**
- **Le référencement du site public est fait** — et `robots.txt` **interdit toute
  indexation** tant que `NEXT_PUBLIC_SITE_URL` n'est pas une adresse HTTPS. C'est voulu, et
  c'est la première chose qui surprendra qui déploie sans l'avoir lu (`lib/site.ts`).
- **Le tunnel, l'espace client et l'espace formateur sont passés au design system.** Plus
  aucune couleur littérale dans `(public)`, `(espace)`, `(formateur)` ni `components`. Les
  écrans connectés n'ont cependant **jamais été vus** : ils sont derrière une garde de rôle
  et personne n'a encore ouvert de session dessus.
- **Trois garde-fous nouveaux, tous de la même famille** — rendre l'état dangereux
  impossible plutôt que de compter sur la vigilance : pas d'indexation sans vrai domaine, pas
  de témoignage publié sans consentement enregistré, pas de chiffre affiché sans source ni
  date. Les quatre chiffres de l'accueil ont donc disparu de la page en attendant le client.
- **`docs/09-CHANTIERS.md` dit qui travaille sur quoi**, et remplace le découpage par couche.
- **Git n'est plus « propre » au sens du 8 septembre** : la branche
  `claude/mobile-project-work-c0k1hb` existe encore sur le distant. Elle est entièrement
  fusionnée dans `main` et peut être supprimée sans regret.

## Point d'étape — 8 septembre 2026

Écrit pour que quiconque ouvre une session Claude sur ce dépôt reparte du même état, sans
qu'il faille se le faire raconter. Si tu lis ceci après cette date, vérifie d'abord que c'est
toujours vrai — l'`État d'avancement` plus bas est réputé plus à jour case par case, mais peut
diverger si quelqu'un a codé sans mettre à jour ce fichier.

**Le schéma est à la révision 3, poussé et vérifié sur le projet Supabase hébergé**
(`ovlafpgmrwttxstodqxi`), types régénérés. `npm run db:check` et la suite pgTAP passent : 68
vérifications, 0 échec. Cette base est **partagée entre les deux développeurs** — toujours
prévenir avant `npm run db:push` (`docs/07-REPARTITION.md`).

**Le chemin de l'argent est écrit de bout en bout** : formulaire de qualification → création
de compte et session → liaison Discord → prise de rendez-vous (webhook Cal.com) → fiche
client et émission de proposition côté formateur → paiement Stripe → ouverture de l'accès en
une transaction (`traiter_paiement()`) → renouvellement d'abonnement → révocation automatique
le lendemain de la fin d'accès. Le site public (accueil, catalogue, fiches produit, FAQ,
équipe, contact) est construit et branché sur le vrai catalogue. Le back-office est écrit
lui aussi — CRM, propositions, abonnements, transactions, factures, remboursements, litiges,
comptes, audit, paramètres, catalogue —, `/admin/emails` restant le seul placeholder.
Détail phase par phase dans `État d'avancement` ci-dessous, qui fait foi.

**Rien de tout ça n'a jamais tourné contre les vrais services** : ni serveur Discord, ni
compte Cal.com, ni clés Stripe, ni clé serveur Supabase (`SUPABASE_SERVICE_ROLE_KEY` est vide
dans `.env.local`). Typecheck, lint, `next build` et les invariants de base sont au vert —
c'est tout ce qu'on peut affirmer tant que ces accès manquent. Le client a indiqué les fournir
dans la semaine du 8 septembre.

**Quatre décisions ont été tranchées le 8 septembre, et les quatre sont codées** — détail dans
`01-CAHIER-DES-CHARGES.md` §8 :

- pas de règle d'éligibilité côté Tally : tout prospect qui soumet le formulaire est éligible
  (hors mineurs) — **fait**, `evaluerEligibilite()` renvoie `true` ;
- l'abonnement communauté se vend en self-service, sans passer par l'audit — **fait**,
  `/formations/[slug]/souscrire` ;
- la remise formateur est autorisée sans plafond, Franck décide seul — **fait**, montant
  saisissable et écart avec le catalogue tracé dans `lead_events` ;
- pas de délai de grâce, révocation le lendemain de la fin d'accès — **déjà le comportement
  réel de `revoquer_acces_expires()`, rien à changer**.

**La vérification de l'email bloque désormais le paiement**, comme décidé : non bloquante à
l'inscription et à la prise de rendez-vous, bloquante avant de payer — les deux parcours
d'achat la vérifient. À surveiller de près à la mise en service : **si l'envoi d'emails n'est
pas configuré côté Supabase, plus aucun paiement ne peut aboutir.** C'est le comportement
voulu, mais il faut avoir essayé un vrai parcours d'achat avant d'ouvrir les ventes.

Restent ouverts : l'hébergement des vidéos exclusives d'un des deux abonnements, et le régime
de vente — quelle société vend, et sous quel régime de TVA et de droit de la consommation,
sachant que le vendeur est à Dubaï et les clients dans l'Union (conseil juridique).

**Git est propre** : tout est mergé sur `main`. Si tu vois des branches `a/*`, `b/*` ou
`claude/*` qui traînent, elles sont fusionnées et peuvent être supprimées sans regret après
vérification.

**Un renommage de routes touche le périmètre du développeur B** (`07-REPARTITION.md`) et a été
fait pendant son absence, avec son accord obtenu après coup : `/offres` → `/formations`,
`/coachs` → `/formateurs`, plusieurs routes de la révision 2 supprimées. À avoir en tête avant
de merger du travail commencé sur l'ancienne arborescence.

**Le catalogue de la base hébergée contient encore des données façon révision 2**, migrées
telles quelles : par exemple « Accélérateur » y est un `type_produit = 'formation'` en groupe,
alors que c'est en réalité un accompagnement individuel. Le site affiche donc des données
fausses tant que le catalogue n'a pas été rechargé avec les vrais produits — ce n'est pas un
bug du code, c'est un problème de données à corriger dès qu'elles sont connues.

**Le design system vit dans `apps/web/src/app/globals.css`**, en tokens Tailwind v4. Aucune
page ne pose de couleur littérale : tout passe par `bg-surface`, `text-encre-doux`,
`border-filet`. Une charte est en cours chez un designer — elle se branchera dans ce fichier,
pas dans les pages. Direction retenue en attendant : clair, aéré, contrasté, à l'image de
Mindeo citée en référence ; le noir et doré du site actuel est explicitement écarté.

## Structure

```
apps/web/src/app/
  (public)/      Site public et tunnel — une page par ligne de 02-SITEMAP.md
  (espace)/      Espace client — garde de layout : rôle client
  (formateur)/   Espace formateur — garde de layout : formateur
  (admin)/       Back-office — garde de layout : admin, owner
  api/           Webhooks (whop, cal, discord, resend)
apps/web/src/lib/
  supabase/      client.ts (navigateur), server.ts (serveur, RLS),
                 service-role.ts (contourne la RLS, server-only), proxy.ts
  auth/          roles.ts — lecture des rôles, gardes de layout
apps/bot         Worker Discord — consomme discord_sync_queue
packages/db      Types générés depuis le schéma, partagés web ↔ bot
supabase/        migrations/, seed.sql, tests/ (pgTAP)
docs/            Spécification
```

## Commandes

```bash
npm run dev              # Next.js sur :3000
npm run db:check         # Applique migrations + seed sur PGlite et rejoue les invariants RLS
npm run db:push          # Applique les migrations en attente sur le projet hébergé
npm run db:types:linked  # Régénère packages/db/src/database.types.ts depuis le projet hébergé
npm run db:types         # Idem depuis une instance locale — exige Docker, donc CI seulement
npm run auth:modeles     # Pose les modèles d'email sur un projet hébergé (jeton de gestion requis)
npm run typecheck
```

Après **toute** modification du schéma : `npm run db:check`.

`db:types` est la commande de référence mais elle passe par `--local`, donc par Docker :
sur le poste de développement, c'est `db:types:linked` qu'il faut lancer, et seulement
**après** `db:push`, puisqu'elle lit le schéma réellement appliqué sur la base hébergée.
`db:push` écrit sur la **base partagée** : prévenir l'autre développeur avant de la lancer.

## Docker n'est pas disponible en local

Le poste de développement est derrière un proxy d'entreprise qui bloque Docker
Desktop, et le compte n'a pas les droits administrateur pour installer WSL. `supabase
start`, `supabase db reset` et `supabase test db` **ne tournent pas en local** — les
scripts existent (`db:start`, `db:reset`, `db:test`) mais ne servent qu'en CI.

En remplacement, `npm run db:check` applique les migrations et le seed sur un
PostgreSQL réel compilé en WebAssembly (PGlite), puis rejoue les invariants de
cloisonnement. C'est la boucle de vérification de tous les jours.

Ce qu'il ne couvre pas : GoTrue, PostgREST, le Storage, les extensions Supabase. La
suite pgTAP de `supabase/tests/` reste la référence et tourne en CI, où Docker est
disponible. Toute règle vérifiée dans `scripts/verifier-schema.mjs` doit donc **aussi**
exister en pgTAP, et réciproquement : les deux se maintiennent ensemble.

Conséquence pratique : le développement applicatif se fait contre un **projet
Supabase hébergé** (un projet gratuit sert de base de dev partagée), pas contre une
instance locale.

Cette base est **partagée entre les deux développeurs**, et rien ne les isole l'un de
l'autre : une migration appliquée par l'un change l'application de l'autre sans qu'aucun
fichier ait bougé, et une donnée saisie à la main avec un compte du seed rend le seed non
reproductible. Le problème est ouvert — mitigations du quotidien et solution envisagée
(le branching du plan Pro) dans `docs/07-REPARTITION.md`.

## Ce qu'il ne faut pas casser

Ces règles ne sont pas des préférences de style. Chacune correspond à un incident
identifié en conception ; les contourner « juste pour ce cas » est la façon dont
elles cèdent.

**La RLS est la sécurité, pas le filtre d'affichage.** Un `where user_id = ...`
dans une requête est du confort. La garantie est dans la politique. Toute nouvelle
table : `enable row level security` dans la même migration que le `create table`,
et une politique explicite — ou une absence de politique assumée et commentée.

**Un formateur ne voit que ses affectations, et jamais d'argent.** Ces deux invariants sont
testés dans `supabase/tests/01_rls_formateur.test.sql` et rejoués par `npm run db:check`. Un
test qui casse là signale une fuite de données, pas un test à ajuster. Depuis la révision 3,
l'ancrage est l'affectation explicite — `inscriptions.formateur_id` et `leads.assigned_to` —
et non plus `cohorte_coachs`, ni une dérivation depuis `appointments` : « il a eu un appel
avec cette personne un jour » élargit le périmètre en silence à chaque RDV repris d'un
collègue absent. Seule exception à « jamais d'argent » : `propositions.montant_cents`, que
le formateur émet lui-même et qui est le prix catalogue, public. Ce que le client a
réellement payé lui reste fermé.

**Jamais d'URL de vidéo en base.** Une table de vidéos ne stocke que `provider_asset_id` ;
l'URL signée est émise côté serveur, à durée courte, après revérification de l'inscription.
Règle en sommeil depuis la révision 3 : les replays sont sur Discord, et la table `replays`
a été supprimée. Elle se réveille intacte le jour où une vidéo à accès restreint revient
côté site — ce qui pourrait arriver plus vite que prévu, l'un des deux abonnements envisagés
donnant accès à des « vidéos exclusives » (voir les décisions en attente).

**Les webhooks insèrent d'abord dans `payment_events`.** Dans la même transaction que
le traitement métier. Violation de la contrainte unique = événement déjà traité, on
sort sans rien faire. Stripe et PayPal rejouent : c'est le fonctionnement normal, pas
un cas limite.

« Même transaction » est impossible à tenir depuis le client JavaScript, où chaque appel est
sa propre transaction. C'est pourquoi tout le traitement vit dans **`traiter_paiement()`**
(et `renouveler_abonnement()` pour les mois suivants) : le handler vérifie la signature,
extrait les métadonnées, et fait **un seul** appel. Ajouter une écriture métier côté
TypeScript, après l'appel, rouvrirait exactement la faille — un événement marqué traité et
un client sans accès, sans rien pour le rattraper. Ces deux fonctions sont testées pour
l'idempotence en PGlite **et** en pgTAP.

**Discord passe par la file.** On écrit dans `discord_sync_queue`, jamais d'appel
direct à l'API Discord depuis un handler de paiement. Une coupure Discord ne doit pas
faire perdre un accès client silencieusement.

**`SUPABASE_SERVICE_ROLE_KEY` contourne la RLS.** Serveur uniquement. Jamais dans un
composant client, jamais dans une variable préfixée `NEXT_PUBLIC_`.

**Un paramètre d'URL transporte un accent, jamais une proposition — et le fragment aussi.** Ce qu'un message affirme
vient des données que la page a chargées, pas de la chaîne qu'on lui a passée — n'importe qui
la tape à la main, et un favori la garde pour toujours. Le test avant d'ajouter un code à
`lib/messages/catalogue.ts` : _si un inconnu tape cette URL sur une page où rien ne s'est
passé, ce qu'il lit est-il encore vrai ?_ Si oui, c'est une constante. Sinon, c'est un code
dépendant : il se construit à partir d'une `Preuve` (`lib/messages/preuves.ts`, type marqué,
bornée à dix minutes) et **ne rend rien quand la preuve manque** — pas un message dégradé,
pas de message. Et un message ne s'écrit jamais à la main : `MessageBloc` et `MessageLigne`
posent le rôle ARIA à partir du ton, ce qui est la seule raison pour laquelle « Paiement
reçu » ne peut plus s'afficher sans être annoncé.

Le `#` compte autant que le `?` : **Supabase range ses échecs d'authentification dans le
fragment**, qui n'est jamais envoyé au serveur. Une route de rappel qui n'y voit pas de `code`
n'a donc pas le droit d'en conclure que la personne a annulé — elle n'en sait rien.
`MessageURL` lit le fragment côté navigateur, et il l'emporte sur ce que le serveur a deviné.

**L'argent est en centimes, en entier.** Jamais de flottant.

**Les rôles vivent dans `user_roles`.** Jamais dans `profiles`, jamais dans les
métadonnées du JWT : une colonne de rôle éditable par le porteur du compte est une
élévation de privilège offerte.

**Un `insert into auth.users` doit remplir les colonnes de jetons en chaîne vide,
jamais NULL.** `confirmation_token`, `recovery_token`, `email_change`,
`email_change_token_new`, `email_change_token_current`, `phone_change`,
`phone_change_token`, `reauthentication_token`. GoTrue les scanne dans des champs Go
non nullables ; une seule NULL et la connexion répond 500 « Database error querying
schema », sans rien dans les politiques RLS pour l'expliquer. Cassé une fois en
silence sur le projet hébergé — ni pgTAP ni PGlite ne l'auraient vu, aucun des deux
ne fait un vrai `/auth/v1/token`. C'est pour ça que la CI fait maintenant un login
réel (`.github/workflows/ci.yml`, job _database_) en plus des tests RLS.

## Conventions

- Schéma, colonnes, valeurs d'énumération : **en français**, comme la spécification.
  Le code TypeScript est en anglais sauf pour les noms issus du domaine.
- Migrations : `AAAAMMJJHHMMSS_domaine.sql`, jamais modifiées après application.
  Une correction est une nouvelle migration.
- Commentaires : expliquer _pourquoi_, le _quoi_ se lit dans le code.

## État d'avancement

Phases de `docs/06-PERIMETRE.md`, réordonnées en révision 3 sur le chemin de l'argent.

- [x] **1 — Fondations** : schéma, RLS, seed multi-rôles, tests pgTAP, poussé et
      vérifié sur le projet Supabase hébergé (`ovlafpgmrwttxstodqxi`). Cette base est
      **partagée avec l'autre développeur** — toujours prévenir avant `npm run db:push`.
- [~] Scaffold transverse : Next.js, route groups, clients Supabase, gardes de rôle —
  vérifié avec de vraies sessions, et remis à l'arborescence de la révision 3. **Les pages ne
  sont plus des placeholders**, hormis celles listées comme telles ci-dessous. **Les gardes de
  layout ont été revérifiées le 15 septembre**, avec une vraie session de chaque rôle et
  depuis un poste qui atteint la base : elles sont justes, resserrage de `/admin` et
  `(formateur)` compris.
- [x] **1 bis — Migrations de la révision 3** : sept migrations `20260908*_a_*` — renommages
      `offres` → `formations` et `coach` → `formateur`, suppression des cohortes / sessions /
      présences / replays / `coaching_sessions` / `payment_schedules`, `type_produit`,
      `modalite`, `duree_acces_jours`, colonnes du formulaire, `propositions`,
      `subscriptions`, et la RLS du formateur réancrée sur l'affectation. Seed, tests pgTAP
      et `scripts/verifier-schema.mjs` refaits avec. **Poussé sur le projet hébergé et
      `packages/db/src/database.types.ts` régénéré depuis lui** — comme toutes les migrations
      qui ont suivi (paiement, révocation, RLS espace client). Un `npm run db:types:linked`
      après un pull suffit à revérifier que rien n'a divergé.
- [~] **2 — Tunnel d'entrée** : formulaire natif en cinq écrans, création de compte et session,
  liaison Discord par `linkIdentity` puis `grant` du rôle `invité`, webhook Cal.com. **Écrit,
  jamais exécuté** : ni serveur Discord, ni compte Cal.com, ni clé serveur Supabase.
- [~] **3 — Espace formateur** : tableau de bord, rendez-vous avec issue et compte rendu, liste
  et fiche client, émission de proposition, statistiques. **Repris le 16 septembre pour l'usage
  quotidien** : file « à faire », échanges consignés dans `lead_events`, historique, entonnoir et
  délais. Même réserve — ces pages s'affichent, mais aucun formateur n'a de prospect sur la base
  partagée, donc aucune n'a été vue remplie.
- [~] **4 — Paiement une fois** : ouverture du paiement depuis la proposition, webhook Stripe,
  et `traiter_paiement()` qui fait tout le reste **en une transaction** — idempotence,
  commande, encaissement, inscription, facture, rôle Discord, proposition, prospect. Son
  idempotence est testée en PGlite et en pgTAP. Manquent les clés Stripe.
- [~] **5 — Abonnement** : renouvellement et résiliation traités par le webhook
  (`renouveler_abonnement()`, résiliation à effet différé), et révocation en fin d'accès par
  `revoquer_acces_expires()`, déclenchée par `api/cron/revocation`. L'écran de résiliation
  côté client **est écrit** (`/espace/factures`, en deux temps et sans écran de rétention).
  **Le planificateur est écrit pour Vercel** (`apps/web/vercel.json`, 16 septembre) : il ne
  tournera qu'une fois le site déployé en production avec `CRON_SECRET` — d'ici là, la
  fonction existe et ne tourne jamais.
- [x] **6 — Espace client** : accès en cours, rendez-vous, factures et **résiliation de l'abonnement**,
      compte, liaison Discord. La proposition et son paiement y vivent aussi.
- [~] **7 — Site public** : accueil, catalogue et fiches produit branchés sur le vrai catalogue,
  équipe, questions fréquentes, contact. Design system en tokens dans `globals.css`, écrit pour
  être remplacé par la charte du designer sans toucher aux pages. **Le référencement est fait** :
  `sitemap.xml` tire les fiches du catalogue, `robots.txt` **interdit tout tant que le site n'est
  pas servi en HTTPS depuis son vrai domaine** (`lib/site.ts`), `metadataBase` et les balises Open
  Graph sont posées, et les données structurées couvrent l'organisme, les fiches produit et la FAQ
  — sans note moyenne faute de témoignages ; la raison sociale y est depuis le 21 septembre.
  **Les témoignages et les fiches formateurs sont branchés** — accueil, fiches produit et
  `/formateurs` les affichent dès qu'ils existent en base, et s'effacent tant qu'ils n'existent
  pas. Un témoignage ne se publie pas sans consentement enregistré ; la forme attendue est
  montrée au client dans `/admin/contenu`, avec des exemples fictifs qui ne quittent jamais le
  back-office.
  **Les pages légales sont rédigées** (21 septembre) à partir des textes de l'ancien site :
  mentions légales, CGV, avertissement sur les risques, rétractation et remboursement,
  confidentialité, cookies. Le vendeur est APEX COMPANY L.L.C-FZ (`lib/legal/societe.ts`). Les
  CGV s'acceptent par deux cases avant chaque paiement, enregistrées dans `consents`. **Non
  relues par un juriste.**
  **Restent à faire** : la relecture juridique, le médiateur, la TVA et le représentant RGPD ;
  `/accessibilite`, qui attend un audit ; les témoignages et les biographies eux-mêmes, qui
  attendent du contenu client ; l'image Open Graph, qui attend la charte du designer.
- [~] **Back-office** : garde admin/owner resserrée, navigation par sections, tableau de bord,
  **CRM prospects** (liste filtrable par étape du pipeline, fiche complète avec affectation et
  statut), **propositions** (avec l'écart au prix catalogue, puisque la remise est libre),
  **abonnements** (triés par urgence : impayés d'abord), **transactions**, **catalogue** et
  **automatisations**. `/admin/audit` est écrit et **pose sa propre garde `owner`** — le layout
  laisse entrer `admin`, la page refuse, et la RLS refuse derrière elle.
  **Factures, remboursements, litiges, comptes et rôles, paramètres** sont écrits eux aussi.
  `/admin/parametres` pose sa garde `owner` comme `/admin/audit`, et montre quels services
  sont réellement branchés — sans jamais afficher la valeur d'une clé.
  **La fiche client** (`/admin/clients` et `/admin/clients/[id]`) rassemble accès, commandes,
  encaissements, factures, abonnements et liaison Discord — cette dernière en tête, parce que
  c'est la première chose à vérifier quand un accès n'arrive pas.
  **Les remboursements s'exécutent** depuis le back-office : demande depuis la fiche client,
  exécution depuis `/admin/paiements/remboursements`. L'appel Stripe passe une clé
  d'idempotence bâtie sur l'identifiant de la ligne — rembourser deux fois est le seul risque
  qui compte ici — et `enregistrer_remboursement()` referme la commande, l'inscription et le
  rôle Discord en une transaction.
  **`/admin/aide`** porte les runbooks d'exploitation, rangés par **symptôme** et non par
  mécanisme — on y arrive avec la phrase d'un client, pas avec le nom d'une fonction. Ce qui
  peut être mesuré y est lu en base plutôt qu'affirmé : une aide qui écrirait « la
  réconciliation tourne tous les jours » deviendrait fausse sans que personne ne le voie.
  **Le contenu éditorial a ses écrans** : `/admin/temoignages`, `/admin/formateurs`, et
  `/admin/contenu` qui montre au client la forme attendue sur des exemples fictifs — confinés
  au back-office, chaque nom portant « (exemple) ». La publication d'un témoignage est refusée
  sans consentement enregistré, par l'écran **et** par la base. La suppression, dans ces deux
  écrans, se confirme en deux temps : elle efface aussi la trace du consentement, le
  déclencheur d'audit ne couvrant que les modifications (`docs/09-CHANTIERS.md`).
  **`/admin/legal`** rassemble l'inventaire des traitements de données — relevé table par
  table, à relire à chaque migration qui en touche une — et ce qu'il faut obtenir pour écrire
  chaque page légale. Une seule réponse débloque la moitié de la liste : qui vend.
  **`/admin/emails`** (18 septembre) : état de l'envoi, registre des emails partis, aperçu des modèles.
  **`/statistiques`** (16 septembre) donne la conversion par réseau au rôle `branding` — une
  page hors de `(admin)`, liée depuis le back-office, vue à l'écran avec de vraies sessions.
  **L'édition du catalogue est écrite** (`/admin/formations/[id]` et `/nouveau`), avec deux
  garde-fous : la cohérence type de produit / durée d'accès est vérifiée avant la base pour
  donner un message lisible, et **un produit ne peut pas être publié sans rôle Discord** — il
  encaisserait un paiement sans ouvrir d'accès. Un brouillon, si.
- [ ] 8 — Événements, migration des données, recette, mise en production
- [~] **Transverse — Discord** : worker écrit (apps/bot), suit `discord_sync_queue` au plus
  près du schéma. **Vérifié de bout en bout contre un vrai serveur le 12 septembre 2026** —
  liaison, attribution du rôle `invité`, attribution d'un rôle de produit, révocation par
  `revoquer_acces_expires()`. Sur un serveur de **test** : la production attend l'accès
  administrateur.
  `npm run discord:check` diagnostique la mise en service sans rien modifier, et la marche à
  suivre est dans `apps/bot/README.md` : c'est par là qu'il faut commencer.
  Voir apps/bot/README.md. Devient bloquant dès la phase 2, et depuis la décision sur les
  calls de groupe (`docs/06-PERIMETRE.md`), il porte aussi la tenue des cours eux-mêmes,
  pas seulement la synchronisation des rôles.

## Décisions en attente du client

- **Hébergeur des replays** — **tranché, sans objet** : les replays vivent sur Discord.
  Le site n'héberge que de la vidéo marketing, publique par nature, donc sans contrôle
  d'accès à construire.
- **Modèle économique** — **tranché** : trois types de produit. Abonnement mensuel récurrent
  (communauté), accompagnement acheté en une fois pour 1, 3 ou 6 mois, et formation achetée
  en une fois à accès illimité. Une seule mécanique d'accès couvre les trois —
  `inscriptions.date_fin_acces`, avec `null` pour illimité (`01-CAHIER-DES-CHARGES.md` §1).
  La couche paiement, elle, porte bien deux mécaniques : abonnement Stripe et paiement unique.
- **Paiement en plusieurs fois** — **tranché le 8 septembre 2026 : non, tout se paie en une
  fois.** `payment_schedules`, `orders.echelonne` et les deux colonnes d'échelonnement du
  catalogue ont été supprimées (`20260908095000_a_paiement_une_fois.sql`). Si le 3× revient,
  il reviendra par une migration — git garde le fichier pour la retrouver.
- **Les deux abonnements** — **direction donnée, contenu non figé** : un accès communautaire
  premium sur Discord, et un accès à des **vidéos exclusives**. Le schéma les porte déjà sans
  rien ajouter — deux lignes `formations` en `type_produit = 'abonnement'`, chacune avec son
  `discord_role_id`, et un client peut détenir les deux puisque la révocation se raisonne par
  inscription. **Vidéos exclusives — tranché le 16 septembre 2026 : sur une plateforme
  externe, hors projet.** Rien à construire côté site, et la règle « jamais d'URL de vidéo en
  base » reste en sommeil.
- **Vocabulaire** — **tranché, et fait** : `formations` et `formateur`. Le renommage a
  emporté l'énumération, les politiques RLS, les tests pgTAP, le seed et `packages/db`
  (`20260908090000_a_renommage_formations_formateur.sql`).
- **Éligibilité du formulaire** — **tranché le 8 septembre 2026 : il n'y a pas de règle côté
  Tally.** Tout prospect qui soumet le formulaire est éligible, à l'exception du refus dur des
  mineurs. Aucune branche « non éligible » à construire dans le tunnel.
  `evaluerEligibilite()` renvoie désormais `true` plutôt que `null` : l'évaluation a eu lieu
  et elle est positive, là où `null` aurait laissé un pipeline entier en attente d'arbitrage.
- **Vente en self-service de l'abonnement communauté** — **tranché le 8 septembre 2026 : oui.**
  Achat direct depuis `/formations/[slug]`, sans passer par l'audit. Entorse assumée au « un
  seul tunnel » de `02-SITEMAP.md`. **Écrit** : `/formations/[slug]/souscrire`.
- **Remise accordée par le formateur** — **tranché le 8 septembre 2026 : oui, sans plafond.**
  Franck dirige l'accompagnement commercial et décide seul du prix qu'il propose. **Écrit** :
  montant saisissable, prix catalogue en valeur par défaut, et écart consigné dans
  `lead_events` — c'est la trace qui remplace le plafond.
- **Délai de grâce en fin d'accès** — **tranché le 8 septembre 2026 : aucun.** La révocation a
  lieu le lendemain de la date de fin d'accès. C'est déjà le comportement de
  `revoquer_acces_expires()`, qui sélectionne `date_fin_acces < current_date` : rien à changer.
- **Calendrier** — **tranché, décision déléguée aux développeurs** : `Cal.com`. Moins cher que
  Calendly à besoin égal, plan gratuit bien plus généreux, `appointments.cal_booking_id` et la
  route `api/cal` restent valables, et l'auto-hébergement reste une porte de sortie.
  **Cal.com ne sert qu'une fois dans le parcours** : l'audit de vente. Les séances qui suivent
  l'achat ne se réservent pas sur le site.
  **Un seul compte, une seule page** — précisé le 8 septembre 2026 : c'est Franck qui prend
  tous les rendez-vous. `/reserver` n'aiguille donc vers personne et il n'y a pas d'écran de
  choix du formateur. **À vérifier à l'inscription** : si les webhooks s'avèrent réservés au
  plan Teams, c'est 12 $/mois pour une personne, pas par formateur. Sans webhook, pas de ligne
  `appointments`, donc pas de tableau de bord formateur.
- **Individuel ou groupe** — **tranché** : porté par `formations.modalite`, un axe distinct de
  `type_produit` (qui dit comment on paie, pas comment le cours se donne). C'est une colonne
  d'information — fiche produit et back-office. L'accès ne change pas, et **la planification
  reste hors plateforme** : les formateurs organisent les séances individuelles avec leur
  client, le planning de groupe s'annonce sur Discord (`01-CAHIER-DES-CHARGES.md` §3, étape
  4 bis). Pas de table `seances` : la suppression de `coaching_sessions` est confirmée.
- **Plan Supabase Pro pour le développement** — **tranché le 16 septembre 2026 : non.** Deux
  développeurs, on reste sur la base de dev partagée, et on veille à ce qu'elle ne passe pas
  en veille (une semaine sans activité). La **production** est une autre question : un projet
  gratuit n'a pas de sauvegarde quotidienne, ce qui ne se défend pas pour une base qui porte
  des paiements. Le plan Pro y est recommandé à l'ouverture des ventes, et figure dans les
  abonnements à la charge du client (`docs/08-CE-QUI-MANQUE.md`).
- **Tutoiement ou vouvoiement** — **tranché le 16 septembre 2026, décision déléguée aux
  développeurs : vouvoiement sur tout le site** (public, tunnel, espace client, espace
  formateur, emails). Mindeo, la référence citée par le client, vouvoie ; on vend des
  accompagnements chers sur un sujet d'argent, avec un vendeur à l'étranger, et c'est la
  confiance qui convertit. Discord reste libre de tutoyer, c'est l'usage d'une communauté.
  Le back-office, qui ne s'adresse qu'à l'équipe, n'est pas concerné. **Fait le 16 septembre** :
  tout nouveau texte visible par un client se vouvoie.
- **Prestataire de paiement** — **tranché le 23 septembre 2026 : Whop**, en remplacement de
  Stripe, par l'API et le webhook plutôt que par les liens tout faits du client. Un seul
  prestataire : l'énumération `payment_provider` garde `stripe` et `paypal` parce que des
  encaissements passés les portent, mais plus rien n'écrit sous ces valeurs. **Whop n'attribue
  pas les rôles Discord** — l'accès reste à nous. **Fait**, non vérifié contre le vrai service.
- **Événements et séminaires** — **tranché le 23 septembre 2026 : non, pas sur le site.** Posé
  au moment où le catalogue Whop a fait apparaître APEX MASTERY, un séminaire daté en trois
  formules. La plateforme ne gère aucune réservation de place : pas de table d'événements, pas
  de jauge, pas de date. Ça confirme ce que `02-SITEMAP.md` actait (billetterie externe) et ce
  que `/evenements` affiche déjà. Les billets se vendent par un lien Whop, et leurs
  encaissements passent par la file de rattrapage comme tout paiement ouvert hors du site.
- **Salons Discord** — **tranché le 16 septembre 2026 par défaut, sauf objection du client** :
  un `invité` voit l'accueil, le règlement, les annonces et un salon d'échange général ; le
  salon planning est en lecture seule (l'équipe publie, les membres lisent) ; un rôle
  `Formateur` voit tous les salons de produit, attribué à la main et **jamais géré par le
  bot** — la réconciliation ne touche que les rôles du site.
- **Qui vend** — **tranché le 21 septembre 2026** : APEX COMPANY L.L.C-FZ, désignée par les
  textes légaux de l'ancien site (`lib/legal/societe.ts`).
- **TVA** — **repris le 23 septembre 2026 avec le changement de prestataire** : le calcul revient
  à Whop, en mode « Whop collecte et reverse » (2 %), retenu faute de recul côté client parce
  que c'est le seul qui n'oblige pas APEX COMPANY à s'immatriculer elle-même au guichet unique
  non-Union. **Il fait de Whop le vendeur apparent sur la facture fiscale**, ce que les pages
  légales du 21 septembre ne disent pas : à relire avec le juriste. Le code ne parie sur aucun
  mode — une TVA non rapportée reste `null`, jamais un zéro.
- **Abonnement** — **tranché le 22 septembre 2026** : il se résilie, il ne se rembourse pas ; la
  rétractation s'éteint à l'accès, comme pour une formation. Seul l'accompagnement se rétracte
  au prorata.
- **Conservation des prospects** — **tranché le 16 septembre 2026, sur la recommandation de
  la CNIL** : trois ans après le dernier contact venant du prospect, puis suppression.
  L'adresse IP du consentement suit le consentement qu'elle prouve. Un juriste peut
  resserrer. **Écrit le 16 septembre** : `purger_prospects_inactifs()` et
  `api/cron/purge-prospects`, avec un mode simulation — appliqué sur la base hébergée, planificateur à brancher.
- **Hébergement** — **recommandé le 16 septembre 2026** : le site sur Vercel (plan Pro, le
  plan gratuit interdisant l'usage commercial), qui porte aussi la tâche quotidienne de
  révocation ; le worker Discord, processus long, sur un petit hébergeur de conteneur
  (Railway ou équivalent). Reste à la charge du client d'ouvrir les comptes.
- **Connexion des clients** — **tranché le 17 septembre 2026, décision déléguée aux
  développeurs : par email (lien et code), sans mot de passe.** Le parcours des plateformes de
  formation et de communauté comparables, cohérent avec des comptes créés sans mot de passe par
  le formulaire. L'équipe garde le mot de passe. **Fait.**
- **Messagerie coach ↔ client** — recommandation : hors v1, l'échange reste sur
  Discord. Voir l'argumentaire dans `docs/06-PERIMETRE.md`.
