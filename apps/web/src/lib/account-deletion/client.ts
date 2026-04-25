/**
 * Client web pour le flow de suppression de compte avec période de grâce
 * (KIN-086, E9-S03 + E9-S04).
 *
 * Encapsule les 4 endpoints du relais :
 * - POST /me/account/deletion-request (JWT requis)
 * - POST /me/account/deletion-confirm (token uniquement)
 * - POST /me/account/deletion-cancel (JWT requis)
 * - GET  /me/account/deletion-status (JWT requis)
 *
 * **Zero-knowledge** : aucune donnée santé dans les payloads. Le token de
 * step-up est généré côté serveur et acheminé par e-mail.
 */

import { apiFetch, ApiError } from '../api-client';
import { useAuthStore } from '../../stores/auth-store';

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

function withAuthToken(opts: {
  method: 'GET' | 'POST';
  body?: string;
}): Parameters<typeof apiFetch>[1] {
  const token = useAuthStore.getState().accessToken;
  // exactOptionalPropertyTypes : on n'inclut pas la clé `token` si elle
  // est absente plutôt que de la mettre à `undefined`.
  if (token === null) {
    return opts.body !== undefined
      ? { method: opts.method, body: opts.body }
      : { method: opts.method };
  }
  return opts.body !== undefined
    ? { method: opts.method, token, body: opts.body }
    : { method: opts.method, token };
}

export async function getDeletionStatus(): Promise<DeletionStatus> {
  return apiFetch<DeletionStatus>('/me/account/deletion-status', withAuthToken({ method: 'GET' }));
}

export async function postDeletionRequest(payload: DeletionRequestPayload): Promise<void> {
  await apiFetch<{ ok: boolean }>(
    '/me/account/deletion-request',
    withAuthToken({ method: 'POST', body: JSON.stringify(payload) }),
  );
}

export async function postDeletionConfirm(token: string): Promise<DeletionConfirmResult> {
  return apiFetch<DeletionConfirmResult>('/me/account/deletion-confirm', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function postDeletionCancel(): Promise<void> {
  await apiFetch<{ ok: boolean }>('/me/account/deletion-cancel', withAuthToken({ method: 'POST' }));
}

export { ApiError };
