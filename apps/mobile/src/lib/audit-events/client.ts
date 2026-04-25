/**
 * Client mobile `GET /me/audit-events` (KIN-093, E9-S09).
 *
 * Symétrique de `apps/web/src/lib/audit-events/client.ts` — l'app mobile
 * utilise le même contrat HTTP. Le store auth mobile fournit le JWT.
 *
 * Refs: KIN-093, E9-S09, RM11.
 */

import { ApiError } from '../api-client';
import { useAuthStore } from '../../stores/auth-store';

const API_BASE = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export type AuditEventType =
  | 'report_generated'
  | 'report_shared'
  | 'privacy_export'
  | 'account_deletion_requested'
  | 'account_deletion_cancelled'
  | 'account_deleted';

export interface AuditEventListItem {
  readonly id: string;
  readonly eventType: string;
  readonly eventData: Readonly<Record<string, unknown>>;
  readonly createdAtMs: number;
}

interface AuditEventListResponse {
  readonly events: ReadonlyArray<AuditEventListItem>;
}

export async function listMyAuditEvents(): Promise<ReadonlyArray<AuditEventListItem>> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/me/audit-events`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(
      res.status,
      typeof body['error'] === 'string' ? body['error'] : 'list_failed',
    );
  }
  const data = (await res.json()) as AuditEventListResponse;
  return data.events;
}
