'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { MessageLigne } from '@/components/message';
import { BoutonAction, CHAMP, Carte, Conteneur } from '@/components/ui';
import { PARAM, messageConstant } from '@/lib/messages/catalogue';
import { alerte, type Message } from '@/lib/messages/types';
import { rolesConnus } from '@apex/db';

import { destinationApresConnexion } from '@/lib/auth/destination';
import { createClient } from '@/lib/supabase/client';

/**
 * `/connexion`.
 *
 * **Les clients se connectent par un email, jamais par un mot de passe.** Leur
 * compte est créé sans mot de passe par le formulaire (`creerCompteEtSession`),
 * et une page qui leur en demandait un les laissait dehors pour toujours dès
 * que leur session tombait — dans l'espace qui porte leurs accès, leurs
 * factures et la résiliation de leur abonnement. Un « mot de passe oublié »
 * aurait proposé de réinitialiser un mot de passe qui n'a jamais existé.
 *
 * C'est le parcours des plateformes de formation et de communauté comparables,
 * et il n'est pas moins sûr : un mot de passe réinitialisable est lui aussi
 * adossé à la boîte mail, et il se réutilise d'un site à l'autre.
 *
 * L'email porte un lien **et** un code. Le lien est le geste simple ; le code
 * sert quand l'email est lu sur le téléphone et la connexion faite sur
 * l'ordinateur.
 *
 * **L'équipe garde son mot de passe** : elle se connecte tous les jours, et un
 * aller-retour par la boîte mail à chaque fois serait intenable.
 *
 * **La redirection dépend du rôle**, et ce n'est pas un confort. Envoyer tout
 * le monde vers `/espace` renvoyait les comptes du staff vers `/` : le seed
 * retire le rôle `client` aux comptes internes, donc la garde de `(espace)`
 * les rejetait. La règle vit dans `destinationApresConnexion()`, partagée pour
 * que le header, cette page et `/connexion/confirmer` ne puissent pas diverger.
 */

/**
 * Les échecs d'authentification, dits en français.
 *
 * **`error.message` ne s'affiche jamais** : GoTrue répond en anglais (« Invalid
 * login credentials ») sur un site qui est en français de bout en bout, et son
 * texte parle de son implémentation, pas de ce que la personne doit faire. On
 * traduit donc `error.code`, qui est stable, et on retombe sur une phrase
 * générique pour ce qu'on n'a pas prévu.
 *
 * `invalid_credentials` ne distingue pas l'email inconnu du mot de passe faux,
 * et c'est voulu : dire « ce compte n'existe pas » révèle qui est client.
 */
const MESSAGES_AUTH: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe incorrect.',
  email_not_confirmed:
    'Votre adresse email n’est pas encore vérifiée. Ouvrez le lien que nous vous avons envoyé, puis réessayez.',
  over_request_rate_limit: 'Trop de tentatives. Réessayez dans quelques minutes.',
  over_email_send_rate_limit:
    'Un email vient déjà d’être envoyé à cette adresse. Patientez une minute avant d’en demander un autre.',
  otp_expired: 'Ce code a expiré ou n’est pas le bon. Utilisez celui du dernier email reçu.',
  user_banned: 'Ce compte est suspendu. Écrivez-nous depuis la page contact.',
  validation_failed: 'Vérifiez l’adresse email saisie.',
};

const messageAuth = (code: string | undefined): string =>
  (code && MESSAGES_AUTH[code]) || 'La connexion a échoué. Réessayez dans un instant.';

/**
 * Ce que Supabase répond quand l'adresse n'a pas de compte. On le traite comme
 * un envoi réussi : afficher une erreur ici dirait à n'importe qui si une
 * adresse est cliente, ce que `invalid_credentials` prend soin de ne pas faire.
 */
const COMPTE_INCONNU = new Set(['otp_disabled', 'signup_disabled', 'user_not_found']);

type Mode = 'lien' | 'mot-de-passe';

export default function ConnexionPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('lien');
  const [envoye, setEnvoye] = useState(false);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Déjà connecté : cette page n'a rien à proposer. La garde est ici et non
  // dans un composant serveur pour que `/connexion` reste générée
  // statiquement — un `cookies()` la rendrait dynamique pour tout le monde,
  // alors que le cas visé est rare.
  useEffect(() => {
    const supabase = createClient();
    let vivant = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!vivant || !data.user) return;
      if (vivant) router.replace(await destinationDe(data.user.id));
    });

    return () => {
      vivant = false;
    };
  }, [router]);

  // Le retour d'un lien qui n'a pas pu servir. Lu ici plutôt que par
  // `MessageURL` : celui-ci attribue les erreurs du fragment à Discord, et la
  // page doit rester statique, donc sans `searchParams` côté serveur. Supabase
  // range l'expiration d'un lien dans le fragment (`#error_code=otp_expired`),
  // d'où la double lecture.
  useEffect(() => {
    const url = new URL(window.location.href);
    const duParametre = url.searchParams.get(PARAM);
    const duFragment = new URLSearchParams(url.hash.slice(1)).has('error');

    if (!duParametre && !duFragment) return;

    const lu = duFragment ? messageConstant('lien-invalide') : messageConstant(duParametre ?? '');
    // Même raison que dans `MessageURL` : l'URL n'existe que dans le
    // navigateur, et on l'efface juste après l'avoir lue.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (lu) setMessage(lu);

    url.searchParams.delete(PARAM);
    url.hash = '';
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
  }, []);

  async function partir(userId: string) {
    // `enCours` reste vrai jusqu'à la navigation : le bouton ne doit pas
    // redevenir cliquable pendant qu'on part, sous peine d'une seconde
    // soumission qui rejouerait la connexion.
    router.push(await destinationDe(userId));
    router.refresh();
  }

  function echec(codeErreur: string | undefined) {
    setEnCours(false);
    setMessage(alerte(messageAuth(codeErreur)));
  }

  async function demanderLien(e?: FormEvent) {
    e?.preventDefault();
    setMessage(null);
    setEnCours(true);

    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Un lien ne crée jamais de compte : c'est le formulaire de
        // qualification qui le fait, avec le consentement qui va avec.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/connexion/confirmer`,
      },
    });

    if (error && !COMPTE_INCONNU.has(error.code ?? '')) return echec(error.code);

    setEnCours(false);
    setCode('');
    setEnvoye(true);
  }

  async function verifierCode(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setEnCours(true);

    const { data, error } = await createClient().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });

    if (error || !data.user) return echec(error?.code ?? 'otp_expired');
    await partir(data.user.id);
  }

  async function connecterAvecMotDePasse(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setEnCours(true);

    const { data, error } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password: motDePasse,
    });

    if (error) return echec(error.code);
    await partir(data.user.id);
  }

  function changerDeMode(suivant: Mode) {
    setMode(suivant);
    setEnvoye(false);
    setMessage(null);
  }

  const champEmail = (
    // Des libellés, pas des seuls `placeholder` : un texte d'exemple disparaît
    // dès la première frappe et n'est pas lu comme un intitulé par un lecteur
    // d'écran.
    <div className="space-y-1.5">
      <label htmlFor="email" className="block text-sm font-medium">
        Adresse email
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className={CHAMP}
      />
    </div>
  );

  return (
    <Conteneur largeur="etroite" className="py-16 sm:py-24">
      <Carte className="space-y-6">
        {mode === 'lien' && !envoye && (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold">Connexion</h1>
              <p className="text-sm text-encre-doux">
                Saisissez l’adresse de votre compte : nous vous envoyons un lien pour vous
                connecter, sans mot de passe.
              </p>
            </div>

            <form onSubmit={demanderLien} className="space-y-4">
              {champEmail}
              <MessageLigne message={message} />
              <BoutonAction type="submit" disabled={enCours} className="w-full">
                {enCours ? 'Envoi…' : 'Recevoir mon lien de connexion'}
              </BoutonAction>
            </form>

            <p className="text-sm text-encre-doux">
              Pas encore de compte ?{' '}
              <Link href="/inscription" className="font-medium underline">
                Créez-le en trente secondes
              </Link>
              , ou{' '}
              <Link href="/qualification" className="font-medium underline">
                faites d’abord le point sur votre situation
              </Link>
              .
            </p>
          </>
        )}

        {mode === 'lien' && envoye && (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold">Vérifiez votre boîte mail</h1>
              {/* « Si un compte existe » : la page ne dit pas si l'adresse est
                  cliente, voir COMPTE_INCONNU. */}
              <p className="text-sm text-encre-doux">
                Si un compte existe pour <strong className="text-encre">{email.trim()}</strong>, un
                email de connexion vient d’y être envoyé. Ouvrez le lien qu’il contient ; pensez à
                regarder dans les indésirables.
              </p>
            </div>

            <form onSubmit={verifierCode} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="code" className="block text-sm font-medium">
                  Ou saisissez le code reçu dans cet email
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6,10}"
                  maxLength={10}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  className={`${CHAMP} tracking-widest`}
                />
              </div>
              <MessageLigne message={message} />
              <BoutonAction type="submit" disabled={enCours} className="w-full">
                {enCours ? 'Connexion…' : 'Se connecter avec ce code'}
              </BoutonAction>
            </form>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <button
                type="button"
                onClick={() => demanderLien()}
                disabled={enCours}
                className="font-medium underline disabled:opacity-50"
              >
                Renvoyer l’email
              </button>
              <button
                type="button"
                onClick={() => changerDeMode('lien')}
                className="font-medium underline"
              >
                Utiliser une autre adresse
              </button>
            </div>
          </>
        )}

        {mode === 'mot-de-passe' && (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold">Connexion de l’équipe</h1>
              <p className="text-sm text-encre-doux">
                Réservée aux comptes de l’équipe. Client ? Recevez plutôt un lien de connexion.
              </p>
            </div>

            <form onSubmit={connecterAvecMotDePasse} className="space-y-4">
              {champEmail}
              <div className="space-y-1.5">
                <label htmlFor="mot-de-passe" className="block text-sm font-medium">
                  Mot de passe
                </label>
                <input
                  id="mot-de-passe"
                  type="password"
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                  className={CHAMP}
                />
              </div>
              <MessageLigne message={message} />
              <BoutonAction type="submit" disabled={enCours} className="w-full">
                {enCours ? 'Connexion…' : 'Se connecter'}
              </BoutonAction>
            </form>
          </>
        )}

        <div className="border-t border-filet pt-4 text-sm text-encre-doux">
          {mode === 'lien' ? (
            <button
              type="button"
              onClick={() => changerDeMode('mot-de-passe')}
              className="underline"
            >
              Membre de l’équipe ? Connexion par mot de passe
            </button>
          ) : (
            <button type="button" onClick={() => changerDeMode('lien')} className="underline">
              Recevoir un lien de connexion par email
            </button>
          )}
        </div>
      </Carte>
    </Conteneur>
  );
}

/** Lu sous la RLS (`user_roles_lit_les_siens`) : chacun voit ses propres rôles. */
async function destinationDe(userId: string): Promise<string> {
  const { data: lignes } = await createClient()
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  return destinationApresConnexion(rolesConnus(lignes?.map((l) => l.role) ?? []));
}
