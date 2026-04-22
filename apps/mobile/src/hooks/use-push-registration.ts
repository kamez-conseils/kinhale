import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { requestPushPermission } from '../lib/notifications';
import { apiClient } from '../lib/api-client';

export function usePushRegistration(): void {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    let currentToken: string | null = null;

    void (async () => {
      const pushToken = await requestPushPermission();
      if (!pushToken) return;
      currentToken = pushToken;
      try {
        await apiClient.post('/push/register-token', { pushToken }, { token: accessToken });
      } catch {
        // silencieux — réessai au prochain mount
      }
    })();

    return () => {
      if (currentToken) {
        void apiClient
          .delete('/push/register-token', { pushToken: currentToken }, { token: accessToken })
          .catch(() => undefined);
      }
    };
  }, [accessToken]);
}
