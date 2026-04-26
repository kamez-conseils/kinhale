'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/auth-store';

/**
 * Hook qui redirige vers /auth si l'utilisateur n'est pas authentifié.
 * Retourne true si authentifié, false sinon (dans quel cas la redirection
 * est déjà en cours — le composant appelant peut retourner null).
 *
 * **Hydratation zustand persist** : le store est persisté en localStorage
 * (`kinhale-auth`). Au premier render côté client, `accessToken` vaut
 * `null` AVANT que zustand n'ait lu localStorage, puis prend la vraie
 * valeur. On attend donc le pump d'hydratation (un tour de boucle React)
 * avant de décider d'un redirect — sinon un utilisateur déjà connecté est
 * renvoyé sur /auth à chaque rechargement.
 */
export function useRequireAuth(): boolean {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const authenticated = accessToken !== null && accessToken !== undefined && accessToken !== '';

  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (hydrated && !authenticated) {
      router.replace('/auth');
    }
  }, [hydrated, authenticated, router]);

  return authenticated;
}
