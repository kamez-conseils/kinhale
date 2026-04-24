import { apiFetch, ApiError } from '../api-client';
import { useAuthStore } from '../../stores/auth-store';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

/**
 * Config quiet hours — miroir du type `QuietHours` côté domaine.
 * Ré-exporté ici pour éviter un import profond côté UI.
 */
export interface QuietHoursConfig {
  readonly enabled: boolean;
  readonly startLocalTime: string; // HH:mm
  readonly endLocalTime: string; // HH:mm
  readonly timezone: string; // IANA
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
  // PUT renvoie 204 No Content — `apiFetch` appellerait `res.json()` qui
  // échouerait sur un corps vide. On utilise `fetch` direct pour ce cas.
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
 * Détecte le fuseau local de l'utilisateur via `Intl`. Utilisé comme
 * valeur par défaut au premier passage dans l'écran Settings.
 */
export function detectLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}
