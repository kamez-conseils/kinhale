/**
 * Client web `GET /me/audit-events` (KIN-093, E9-S09).
 *
 * Encapsule l'appel au relais qui retourne les 90 derniers événements
 * d'audit du compte courant — section « Activité du foyer ».
 *
 * **Zero-knowledge** : la réponse ne contient AUCUNE donnée santé. Le
 * filtrage `event_data` whitelist est appliqué côté serveur, défense en
 * profondeur.
 *
 * Refs: KIN-093, E9-S09, RM11.
 */

import { ApiError } from '../api-client';
import { useAuthStore } from '../../stores/auth-store';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

/**
 * Types d'événement reconnus par l'UI. La liste est aligne sur les writes
 * existants (KIN-083 `report_generated`, KIN-084 `report_shared`,
 * KIN-085 `privacy_export`, KIN-086 `account_deletion_*`).
 *
 * Un type inconnu côté UI est traité comme « autre » (libellé i18n
 * fallback) — l'app ne casse jamais sur un type futur.
 */
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

/**
 * Liste les 90 derniers événements d'audit du compte courant.
 *
 * Le serveur applique :
 * - filtrage strict `WHERE account_id = sub` (anti-IDOR),
 * - whitelist `event_data` par type,
 * - tri antéchronologique,
 * - rate-limit 60/h/device.
 */
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
