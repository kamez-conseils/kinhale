import { apiFetch, ApiError } from '../api-client';
import { useAuthStore } from '../../stores/auth-store';

const API_BASE = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export interface QuietHoursConfig {
  readonly enabled: boolean;
  readonly startLocalTime: string;
  readonly endLocalTime: string;
  readonly timezone: string;
}

function getAuthToken(): string | undefined {
  const raw = useAuthStore.getState().accessToken;
  return raw ?? undefined;
}

function withAuth(): { token: string } | Record<string, never> {
  const token = getAuthToken();
  return token !== undefined ? { token } : {};
}

export async function getQuietHours(): Promise<QuietHoursConfig> {
  return apiFetch<QuietHoursConfig>('/me/quiet-hours', { method: 'GET', ...withAuth() });
}

export async function updateQuietHours(config: QuietHoursConfig): Promise<void> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== undefined) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/me/quiet-hours`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(config),
  });
  if (!res.ok && res.status !== 204) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(
      res.status,
      typeof body['error'] === 'string' ? body['error'] : 'update_failed',
    );
  }
}

/**
 * Détecte le fuseau local via `Intl`. Hermes avec Intl activé (Expo SDK 52+,
 * RN 0.74+) supporte `resolvedOptions().timeZone`. Fail-safe en `UTC`.
 */
export function detectLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}
