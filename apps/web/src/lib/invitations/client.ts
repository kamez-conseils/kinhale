import { apiFetch, ApiError } from '../api-client';
import { useAuthStore } from '../../stores/auth-store';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export interface InvitationSummary {
  token: string;
  targetRole: 'contributor' | 'restricted_contributor';
  displayName: string;
  createdAtMs: number;
  /** KIN-096 — vrai si l'invité a déposé sa clé publique X25519. */
  hasRecipientPublicKey?: boolean;
  /** KIN-096 — vrai si l'admin a scellé la `groupKey`. */
  hasSealedGroupKey?: boolean;
  /**
   * KIN-096 — clé publique X25519 (32 octets en hex) du device invité.
   * Présente uniquement quand `hasRecipientPublicKey` est vrai. Non sensible
   * (la clé privée correspondante n'est jamais transmise).
   */
  recipientPublicKeyHex?: string;
}

export interface CreatedInvitation {
  token: string;
  pin: string;
  expiresAtMs: number;
  targetRole: 'contributor' | 'restricted_contributor';
}

export interface InvitationPublicInfo {
  targetRole: 'contributor' | 'restricted_contributor';
  displayName: string;
}

export interface SealedGroupKeyResponse {
  recipientPublicKeyHex: string;
  sealedGroupKeyHex: string;
}

function getToken(): string | undefined {
  const raw = useAuthStore.getState().accessToken;
  return raw ?? undefined;
}

/** Build token option only when a token is available (exactOptionalPropertyTypes). */
function withToken(): { token: string } | Record<string, never> {
  const token = getToken();
  return token !== undefined ? { token } : {};
}

export async function createInvitation(payload: {
  targetRole: 'contributor' | 'restricted_contributor';
  displayName: string;
}): Promise<CreatedInvitation> {
  return apiFetch<CreatedInvitation>('/invitations', {
    method: 'POST',
    ...withToken(),
    body: JSON.stringify(payload),
  });
}

export async function getInvitationPublic(token: string): Promise<InvitationPublicInfo> {
  return apiFetch<InvitationPublicInfo>(`/invitations/${encodeURIComponent(token)}`);
}

export async function acceptInvitation(
  token: string,
  pin: string,
  consentAccepted: boolean,
  recipientPublicKeyHex: string,
): Promise<{
  sessionToken: string;
  targetRole: 'contributor' | 'restricted_contributor';
  displayName: string;
}> {
  return apiFetch<{
    sessionToken: string;
    targetRole: 'contributor' | 'restricted_contributor';
    displayName: string;
  }>(`/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    body: JSON.stringify({ pin, consentAccepted, recipientPublicKeyHex }),
  });
}

export async function revokeInvitation(token: string): Promise<void> {
  const authToken = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken !== undefined) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const res = await fetch(`${API_BASE}/invitations/${encodeURIComponent(token)}`, {
    method: 'DELETE',
    headers,
  });
  // 204 No Content is a successful revoke
  if (!res.ok && res.status !== 204) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? 'invitation_revoke_failed');
  }
}

export async function listInvitations(): Promise<InvitationSummary[]> {
  const data = await apiFetch<{ invitations: InvitationSummary[] }>('/invitations', {
    ...withToken(),
  });
  return data.invitations;
}

/**
 * Admin — dépose l'envelope X25519 (sealed groupKey) pour un invité ayant
 * déjà déposé sa clé publique. KIN-096.
 */
export async function sealInvitation(token: string, sealedGroupKeyHex: string): Promise<void> {
  const authToken = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken !== undefined) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const res = await fetch(`${API_BASE}/invitations/${encodeURIComponent(token)}/seal`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sealedGroupKeyHex }),
  });
  if (!res.ok && res.status !== 204) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? 'invitation_seal_failed');
  }
}

/**
 * Invité — récupère l'envelope X25519 scellée par l'admin. Retourne `null`
 * si l'admin n'a pas encore scellé (404 not_sealed_yet) — le caller doit
 * réessayer plus tard.
 */
export async function fetchSealedGroupKey(token: string): Promise<SealedGroupKeyResponse | null> {
  const res = await fetch(`${API_BASE}/invitations/${encodeURIComponent(token)}/sealed-group-key`, {
    method: 'GET',
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? 'sealed_group_key_fetch_failed');
  }
  return (await res.json()) as SealedGroupKeyResponse;
}
