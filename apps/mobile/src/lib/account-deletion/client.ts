/**
 * Client mobile pour le flow de suppression de compte avec période de
 * grâce (KIN-086, E9-S03 + E9-S04).
 *
 * Pendant mobile de `apps/web/src/lib/account-deletion/client.ts`.
 * Diffère uniquement sur la variable d'env (`EXPO_PUBLIC_API_URL`).
 */

import { ApiError } from '../api-client';
import { useAuthStore } from '../../stores/auth-store';

const API_BASE = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export interface DeletionStatus {
  readonly status: 'active' | 'pending_deletion';
  readonly scheduledAtMs: number | null;
}

export interface DeletionRequestPayload {
  readonly confirmationWord: 'SUPPRIMER' | 'DELETE';
  readonly email: string;
}

export interface DeletionConfirmResult {
  readonly ok: true;
  readonly scheduledAtMs: number;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = useAuthStore.getState().accessToken;
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function parseError(res: Response): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  throw new ApiError(res.status, typeof body['error'] === 'string' ? body['error'] : 'unknown');
}

export async function getDeletionStatus(): Promise<DeletionStatus> {
  const res = await fetch(`${API_BASE}/me/account/deletion-status`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) {
    await parseError(res);
  }
  return (await res.json()) as DeletionStatus;
}

export async function postDeletionRequest(payload: DeletionRequestPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/me/account/deletion-request`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res);
  }
}

export async function postDeletionConfirm(token: string): Promise<DeletionConfirmResult> {
  const res = await fetch(`${API_BASE}/me/account/deletion-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    await parseError(res);
  }
  return (await res.json()) as DeletionConfirmResult;
}

export async function postDeletionCancel(): Promise<void> {
  const res = await fetch(`${API_BASE}/me/account/deletion-cancel`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    await parseError(res);
  }
}

export { ApiError };
