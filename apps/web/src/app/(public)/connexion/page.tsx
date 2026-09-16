'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { MessageLigne } from '@/components/message';
import { BoutonAction, CHAMP, Carte, Conteneur } from '@/components/ui';
import { alerte, type Message } from '@/lib/messages/types';
import { destinationApresConnexion } from '@/lib/auth/destination';
import { createClient } from '@/lib/supabase/client';

/**
 * `/connexion`.
 *
 * **La redirection dépend du rôle**, et ce n'est pas un confort. Envoyer tout
 * le monde vers `/espace` renvoyait les comptes du staff vers `/` : le seed
 * retire le rôle `client` aux comptes internes, donc la garde de `(espace)`
 * les rejetait. On atterrissait sur l'accueil public, qui affiche « Se
 * connecter » — et on se croyait non connecté alors que la session était bien
 * ouverte. La règle vit dans `destinationApresConnexion()`, partagée pour que
 * le header et cette page ne puissent pas diverger.
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
  user_banned: 'Ce compte est suspendu. Écrivez-nous depuis la page contact.',
  validation_failed: 'Renseignez votre adresse email et votre mot de passe.',
};

const messageAuth = (code: string | undefined): string =>
  (code && MESSAGES_AUTH[code]) || 'La connexion a échoué. Réessayez dans un instant.';

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
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

      const { data: lignes } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id);

      if (vivant) router.replace(destinationApresConnexion(lignes?.map((l) => l.role) ?? []));
    });

    return () => {
      vivant = false;
    };
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setEnCours(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: motDePasse,
    });

    if (error) {
      setEnCours(false);
      setMessage(alerte(messageAuth(error.code)));
      return;
    }

    // Lu sous la RLS (`user_roles_lit_les_siens`) : chacun voit ses propres
    // rôles, et rien d'autre.
    const { data: lignes } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id);

    // `enCours` reste vrai jusqu'à la navigation : le bouton ne doit pas
    // redevenir cliquable pendant qu'on part, sous peine d'une seconde
    // soumission qui rejouerait la connexion.
    router.push(destinationApresConnexion(lignes?.map((l) => l.role) ?? []));
    router.refresh();
  }

  return (
    <Conteneur largeur="etroite" className="py-16 sm:py-24">
      <Carte className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold">Connexion</h1>
          <p className="text-sm text-encre-doux">
            Vos accès, vos rendez-vous et vos factures se trouvent dans votre espace.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Des libellés, pas des seuls `placeholder` : un texte d'exemple
              disparaît dès la première frappe et n'est pas lu comme un intitulé
              par un lecteur d'écran. */}
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
      </Carte>
    </Conteneur>
  );
}
