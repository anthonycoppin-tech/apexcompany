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

**Avant de coder quoi que ce soit : ouvrir `09-CHANTIERS.md`, prendre un sujet, committer la
prise et la pousser.** Le verrou est Git, pas l'intention : une prise gardée en local ne
protège de rien. Ce fichier remplace le découpage par couche de `07-REPARTITION.md` — personne
n'est limité à un périmètre, on se répartit par sujet.

**Les quatre documents sont à la révision 3** (8 septembre 2026) : tunnel inversé, trois
types de produit, disparition des cohortes et des replays, espace formateur dédié.
`01-CAHIER-DES-CHARGES.md` porte le raisonnement, les autres en tirent les conséquences.

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
  `audit_offres`. `audit_refunds` reste dehors, et la question qui le précède est notée dans
  `docs/09-CHANTIERS.md`.

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
- **Un système de messages** — il n'en existe aucun, et trois mécaniques improvisées se
  partagent le besoin. Pris aussi.
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
  api/           Webhooks (stripe, paypal, cal, discord)
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
  et fiche client, émission de proposition, statistiques. Même réserve — aucune de ces pages
  n'a tourné contre de vraies données.
- [~] **4 — Paiement une fois** : ouverture du paiement depuis la proposition, webhook Stripe,
  et `traiter_paiement()` qui fait tout le reste **en une transaction** — idempotence,
  commande, encaissement, inscription, facture, rôle Discord, proposition, prospect. Son
  idempotence est testée en PGlite et en pgTAP. Manquent les clés Stripe.
- [~] **5 — Abonnement** : renouvellement et résiliation traités par le webhook
  (`renouveler_abonnement()`, résiliation à effet différé), et révocation en fin d'accès par
  `revoquer_acces_expires()`, déclenchée par `api/cron/revocation`. L'écran de résiliation
  côté client **est écrit** (`/espace/factures`, en deux temps et sans écran de rétention).
  **Reste à brancher** : un planificateur qui appelle réellement la route chaque jour — sans
  lui, la fonction existe et ne tourne jamais.
- [x] **6 — Espace client** : accès en cours, rendez-vous, factures et **résiliation de l'abonnement**,
      compte, liaison Discord. La proposition et son paiement y vivent aussi.
- [~] **7 — Site public** : accueil, catalogue et fiches produit branchés sur le vrai catalogue,
  équipe, questions fréquentes, contact. Design system en tokens dans `globals.css`, écrit pour
  être remplacé par la charte du designer sans toucher aux pages. **Le référencement est fait** :
  `sitemap.xml` tire les fiches du catalogue, `robots.txt` **interdit tout tant que le site n'est
  pas servi en HTTPS depuis son vrai domaine** (`lib/site.ts`), `metadataBase` et les balises Open
  Graph sont posées, et les données structurées couvrent l'organisme, les fiches produit et la FAQ
  — sans note moyenne ni raison sociale, faute de témoignages et de société désignée.
  **Les témoignages et les fiches formateurs sont branchés** — accueil, fiches produit et
  `/formateurs` les affichent dès qu'ils existent en base, et s'effacent tant qu'ils n'existent
  pas. Un témoignage ne se publie pas sans consentement enregistré ; la forme attendue est
  montrée au client dans `/admin/contenu`, avec des exemples fictifs qui ne quittent jamais le
  back-office.
  **Les six pages légales ne sont plus des placeholders** : chacune annonce ce qu'elle
  contiendra, renvoie vers le contact et **se retire de l'indexation** tant qu'elle est dans cet
  état. `/confidentialite` et `/cookies` disent en plus ce qui est déjà vrai — les données
  réellement collectées, les services traversés, l'absence de tout traceur. Aucun texte
  juridique n'y est rédigé, et il n'y en aura pas avant le juriste.
  **Restent à faire** : le contenu des six pages légales, qui attend les informations de la
  société ; les témoignages et les biographies eux-mêmes, qui attendent du contenu client ;
  l'image Open Graph, qui attend la charte du designer.
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
  **Reste un placeholder** : `/admin/emails`, qui attend qu'un envoi d'emails existe.
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
  Le back-office, qui ne s'adresse qu'à l'équipe, n'est pas concerné. L'harmonisation est un
  chantier de `docs/09-CHANTIERS.md`.
- **Second prestataire de paiement (PayPal)** — **tranché le 16 septembre 2026 : pas en v1.**
  Stripe seul. Le schéma garde la place de PayPal ; les variables `PAYPAL_*` restent vides.
- **Salons Discord** — **tranché le 16 septembre 2026 par défaut, sauf objection du client** :
  un `invité` voit l'accueil, le règlement, les annonces et un salon d'échange général ; le
  salon planning est en lecture seule (l'équipe publie, les membres lisent) ; un rôle
  `Formateur` voit tous les salons de produit, attribué à la main et **jamais géré par le
  bot** — la réconciliation ne touche que les rôles du site.
- **Conservation des prospects** — **tranché le 16 septembre 2026, sur la recommandation de
  la CNIL** : trois ans après le dernier contact venant du prospect, puis suppression.
  L'adresse IP du consentement suit le consentement qu'elle prouve. Un juriste peut
  resserrer. **Écrit le 16 septembre** : `purger_prospects_inactifs()` et
  `api/cron/purge-prospects`, avec un mode simulation — appliqué sur la base hébergée, planificateur à brancher.
- **Hébergement** — **recommandé le 16 septembre 2026** : le site sur Vercel (plan Pro, le
  plan gratuit interdisant l'usage commercial), qui porte aussi la tâche quotidienne de
  révocation ; le worker Discord, processus long, sur un petit hébergeur de conteneur
  (Railway ou équivalent). Reste à la charge du client d'ouvrir les comptes.
- **Messagerie coach ↔ client** — recommandation : hors v1, l'échange reste sur
  Discord. Voir l'argumentaire dans `docs/06-PERIMETRE.md`.
