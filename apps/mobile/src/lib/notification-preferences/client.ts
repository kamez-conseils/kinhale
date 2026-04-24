import { apiFetch, ApiError } from '../api-client';
import { useAuthStore } from '../../stores/auth-store';

const API_BASE = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export type NotificationType =
  | 'reminder'
  | 'missed_dose'
  | 'peer_dose_recorded'
  | 'pump_low'
  | 'pump_expiring'
  | 'dispute_detected'
  | 'admin_handover'
  | 'consent_update_required'
  | 'security_alert'
  | 'caregiver_revoked';

export interface NotificationPreference {
  readonly type: NotificationType;
  readonly enabled: boolean;
  readonly alwaysEnabled: boolean;
}

interface PreferencesResponse {
  readonly preferences: ReadonlyArray<NotificationPreference>;
}

function getAuthToken(): string | undefined {
  const raw = useAuthStore.getState().accessToken;
  return raw ?? undefined;
}

function withAuth(): { token: string } | Record<string, never> {
  const token = getAuthToken();
  return token !== undefined ? { token } : {};
}

export async function listNotificationPreferences(): Promise<
  ReadonlyArray<NotificationPreference>
> {
  const data = await apiFetch<PreferencesResponse>('/me/notification-preferences', {
    method: 'GET',
    ...withAuth(),
  });
  return data.preferences;
}

export async function updateNotificationPreference(
  type: NotificationType,
  enabled: boolean,
): Promise<void> {
  // PUT renvoie 204 No Content — on utilise fetch direct pour éviter que
  // `apiFetch` ne tente `res.json()` sur un corps vide.
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== undefined) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/me/notification-preferences`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ type, enabled }),
  });
  if (!res.ok && res.status !== 204) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(
      res.status,
      typeof body['error'] === 'string' ? body['error'] : 'update_failed',
    );
  }
}
