import { apiFetch, ApiError } from '../api-client.js';
import { useAuthStore } from '../../stores/auth-store.js';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export interface InvitationSummary {
  token: string;
  targetRole: 'contributor' | 'restricted_contributor';
  displayName: string;
  createdAtMs: number;
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
    body: JSON.stringify({ pin, consentAccepted }),
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
