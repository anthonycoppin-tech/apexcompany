'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { BoutonAction, CHAMP, Carte, Conteneur } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

/**
 * `/connexion`.
 *
 * La redirection post-connexion mène à `/espace` quel que soit le rôle : un
 * admin qui atterrit sur son espace client y trouve un lien, alors qu'un client
 * renvoyé vers `/admin` se heurterait à la garde de layout. Se tromper dans ce
 * sens-là ne coûte qu'un clic.
 */
export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });

    setEnCours(false);

    if (error) {
      setErreur(error.message);
      return;
    }

    router.push('/espace');
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
