import { useEffect } from 'react';
import { requestPushPermission } from '../lib/notifications';
import { apiClient } from '../lib/api-client';

export function usePushRegistration(): void {
  useEffect(() => {
    void (async () => {
      const token = await requestPushPermission();
      if (!token) return;
      try {
        await apiClient.post('/push/register-token', { pushToken: token });
      } catch {
        // silencieux — réessai au prochain mount
      }
    })();
  }, []);
}
