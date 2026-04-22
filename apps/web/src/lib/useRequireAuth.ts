'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/auth-store';

/**
 * Hook qui redirige vers /auth si l'utilisateur n'est pas authentifié.
 * Retourne true si authentifié, false sinon (dans quel cas la redirection
 * est déjà en cours — le composant appelant peut retourner null).
 */
export function useRequireAuth(): boolean {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const authenticated = accessToken !== null && accessToken !== undefined && accessToken !== '';

  React.useEffect(() => {
    if (!authenticated) {
      router.replace('/auth');
    }
  }, [authenticated, router]);

  return authenticated;
}
