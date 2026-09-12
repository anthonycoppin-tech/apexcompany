'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { BoutonAction, CHAMP, Carte, Conteneur } from '@/components/ui';
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
export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
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
    setErreur(null);
    setEnCours(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: motDePasse,
    });

    if (error) {
      setEnCours(false);
      setErreur(error.message);
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

          {/* `role="alert"` pour que l'échec soit annoncé : sans lui, un lecteur
              d'écran ne signale rien et l'utilisateur croit sa saisie partie. */}
          {erreur && (
            <p role="alert" className="text-sm text-alerte">
              {erreur}
            </p>
          )}

          <BoutonAction type="submit" disabled={enCours} className="w-full">
            {enCours ? 'Connexion…' : 'Se connecter'}
          </BoutonAction>
        </form>
      </Carte>
    </Conteneur>
  );
}
