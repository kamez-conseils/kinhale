import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { requestPushPermission } from '../lib/notifications';
import { apiClient } from '../lib/api-client';

export function usePushRegistration(): void {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return; // ne s'exécute pas tant que l'utilisateur n'est pas authentifié

    void (async () => {
      const pushToken = await requestPushPermission();
      if (!pushToken) return;
      try {
        await apiClient.post('/push/register-token', { pushToken }, { token: accessToken });
      } catch {
        // silencieux — réessai au prochain mount
      }
    })();
  }, [accessToken]); // se re-déclenche à chaque changement d'état d'auth
}
