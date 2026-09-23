/**
 * L'inventaire des traitements de données, relevé dans le code.
 *
 * **Ce n'est pas un registre RGPD** — un registre engage un responsable de
 * traitement nommé, indique une base légale et une durée de conservation par
 * finalité. Le responsable est connu depuis le 21 septembre 2026 (APEX COMPANY
 * L.L.C-FZ), et `/confidentialite` affiche bases et durées ; le registre
 * lui-même reste à tenir par la société.
 *
 * C'est la matière première de ce registre : ce que la plateforme collecte
 * réellement, où ça se range, et chez qui ça transite. Un juriste demande cet
 * état en premier ; le produire ici évite un aller-retour par relevé, et il se
 * vérifie ligne à ligne contre le schéma plutôt que de sortir d'un souvenir.
 *
 * **Il se relit à chaque migration qui touche une de ces tables.** Un inventaire
 * faux est pire qu'absent : il donne l'illusion d'avoir regardé.
 */
export type Traitement = {
  /** La table, telle qu'elle s'appelle en base. */
  table: string;
  /** À quoi elle sert, en une phrase. */
  finalite: string;
  /** Les données personnelles qu'elle porte. Vide si elle n'en porte aucune. */
  donnees: string[];
  /** Ce qui déclenche l'écriture. */
  origine: string;
  /** Ce qui reste à trancher avant de pouvoir l'écrire dans un registre. */
  aTrancher?: string;
};

export const TRAITEMENTS: Traitement[] = [
  {
    table: 'leads',
    finalite: 'Le prospect et ses réponses au formulaire d’orientation.',
    donnees: [
      'prénom',
      'nom',
      'email',
      'téléphone',
      'zone géographique',
      'tranche d’âge',
      'situation professionnelle',
      'niveau de trading',
      'passage en prop firm',
      'blocage déclaré',
      'budget envisagé',
      'échéance',
      'source et paramètres de campagne',
    ],
    origine: 'Soumission du formulaire /qualification, en une seule écriture à la fin.',
    aTrancher:
      'Un prospect qui n’achète pas est supprimé trois ans après son dernier contact (recommandation CNIL, tranché le 16 septembre) — compte, réponses, rendez-vous et consentements. Reste à planifier la tâche, et à faire valider la durée par le juriste.',
  },
  {
    table: 'profiles',
    finalite: 'Le compte client, créé en même temps que le lead.',
    donnees: ['prénom', 'nom', 'email', 'téléphone', 'photo'],
    origine: 'Création du compte à la fin du formulaire, puis modifications depuis /espace/compte.',
    aTrancher:
      'La politique annonce une conservation de trois ans après le dernier achat ou contact. Rien ne l’applique : la purge ne touche que les prospects, et l’effacement sur demande refuse toute personne ayant acheté.',
  },
  {
    table: 'consents',
    finalite:
      'La preuve des consentements : politique de confidentialité à la création du compte, CGV et démarrage immédiat à chaque paiement.',
    donnees: ['email', 'date', 'version du texte accepté', 'adresse IP d’origine'],
    origine:
      'Écrit à la création du compte, puis avant chaque ouverture de paiement (type cgv) — pas de preuve, pas de paiement.',
    aTrancher:
      'L’adresse IP est enregistrée depuis le 16 septembre, et vide quand elle n’est pas connaissable — jamais une valeur de repli. Ce qu’elle vaut dépend de l’hébergeur, qui n’est pas choisi : elle n’est une preuve que s’il écrase « x-forwarded-for » par l’adresse réelle de la connexion. Sinon elle reste déclarative, et c’est à dire au juriste plutôt qu’à présenter comme une preuve.',
  },
  {
    table: 'appointments',
    finalite: 'Le rendez-vous d’orientation et son compte rendu.',
    donnees: ['créneau', 'issue', 'compte rendu écrit par le formateur', 'notes internes'],
    origine: 'Webhook Cal.com, puis saisie du formateur.',
    aTrancher:
      'Le compte rendu est un avis sur une personne. Sa durée de conservation et sa communicabilité à l’intéressé sont à cadrer.',
  },
  {
    table: 'suivi_notes',
    finalite: 'Les notes de suivi du formateur sur un client.',
    donnees: ['contenu libre écrit par le formateur'],
    origine: 'Saisie depuis l’espace formateur.',
    aTrancher:
      'Une note peut être marquée visible ou non par le client. Celles qui ne le sont pas restent communicables sur demande d’accès — à expliquer aux formateurs avant qu’ils n’écrivent.',
  },
  {
    table: 'discord_links',
    finalite: 'Le rattachement du compte à un membre Discord, et les rôles accordés.',
    donnees: ['identifiant Discord', 'pseudonyme Discord'],
    origine: 'Liaison volontaire par le client depuis son espace.',
  },
  {
    table: 'orders, payments, invoices, refunds, disputes',
    finalite: 'Le chemin de l’argent : commande, encaissement, facture, remboursement, litige.',
    donnees: ['montants', 'dates', 'références des transactions'],
    origine: 'Webhooks du prestataire de paiement, en une seule transaction.',
    aTrancher:
      'Le vendeur est APEX COMPANY L.L.C-FZ (Dubaï). La politique annonce dix ans de conservation comptable, repris de l’ancien texte ; le droit émirien en exige cinq. Elle prime sur une demande de suppression.',
  },
  {
    table: 'inscriptions, subscriptions, propositions',
    finalite: 'Ce que la personne a acheté et jusqu’à quand elle y a accès.',
    donnees: ['produit', 'dates d’accès', 'montant proposé'],
    origine: 'Ouverture de l’accès au paiement, résiliation, révocation en fin d’accès.',
  },
  {
    table: 'emails_envoyes',
    finalite: 'Le registre des emails automatiques : lequel est parti, quand, et à quelle adresse.',
    donnees: ['email', 'type d’email', 'dates d’envoi'],
    origine: 'Tâche planifiée horaire, en clé de service. Supprimé avec le compte.',
  },
  {
    table: 'temoignages, formateurs_fiches',
    finalite: 'Le contenu éditorial publié sur le site public.',
    donnees: ['nom affiché', 'propos cités', 'biographie', 'photo'],
    origine: 'Saisie au back-office. Publication impossible sans consentement enregistré.',
    aTrancher:
      'Le retrait du consentement doit laisser une trace. Le déclencheur d’audit de ces deux tables ne couvre pas encore les suppressions — noté dans les chantiers.',
  },
  {
    table: 'audit_logs, automation_logs, lead_events, payment_events',
    finalite: 'La traçabilité : qui a fait quoi, et ce que les services externes ont envoyé.',
    donnees: ['identifiants de comptes', 'contenu brut des événements reçus'],
    origine: 'Déclencheurs en base et webhooks.',
    aTrancher:
      'Les événements bruts contiennent de l’email et du nom. Une demande de suppression doit-elle les atteindre, sachant qu’ils sont la preuve qu’un paiement a eu lieu ?',
  },
];

/**
 * Les services chez qui les données transitent.
 *
 * La liste sort de `/admin/parametres` — ce sont ceux réellement branchés, pas
 * ceux envisagés. Le lieu d'hébergement est celui qu'il faut vérifier compte en
 * main : c'est ce qui décide s'il y a transfert hors Union, et c'est aussi ce
 * qui change quand on change de région de projet sans y penser.
 */
export const SOUS_TRAITANTS: Array<{ nom: string; role: string; aVerifier: string }> = [
  {
    nom: 'Vercel',
    role: 'Hébergement du site. Voit passer toutes les requêtes, donc les adresses IP.',
    aVerifier: 'Recommandé, pas encore souscrit — nommé comme hébergeur dans les mentions légales.',
  },
  {
    nom: 'Supabase',
    role: 'Base de données, comptes et authentification. Toutes les tables ci-dessus.',
    aVerifier: 'La région du projet hébergé, et l’accord de sous-traitance à signer.',
  },
  {
    nom: 'Whop',
    role: 'Encaissement, abonnements, remboursements. Détient les moyens de paiement.',
    aVerifier:
      'Le mode fiscal du compte, et c’est la question la plus lourde de la liste. Sous « Whop ' +
      'collecte et reverse », Whop devient merchant of record sur l’Union : c’est lui qui émet la ' +
      'facture fiscale, pas APEX COMPANY — alors que les mentions légales, les CGV et la page ' +
      'remboursement désignent APEX COMPANY comme vendeur et émetteur. Ces pages n’ont jamais été ' +
      'relues par un juriste ; elles doivent l’être avec cette réponse en main.',
  },
  {
    nom: 'Discord',
    role: 'Communauté et accès. Détient les échanges entre clients et formateurs.',
    aVerifier:
      'Les échanges vivent chez Discord et non chez nous — ce qui est un choix à assumer explicitement dans la politique.',
  },
  {
    nom: 'Resend',
    role: 'Envoi des emails automatiques. Reçoit l’adresse, le prénom et le contenu de chaque email.',
    aVerifier: 'Compte non ouvert. La région d’envoi, et l’accord de sous-traitance.',
  },
  {
    nom: 'Cal.com',
    role: 'Prise de rendez-vous. Reçoit le nom et l’email au moment de la réservation.',
    aVerifier: 'Compte non ouvert. Auto-hébergeable, ce qui supprimerait ce sous-traitant.',
  },
];
