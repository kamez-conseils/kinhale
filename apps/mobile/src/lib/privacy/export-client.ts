/**
 * Client mobile pour l'export de portabilité RGPD/Loi 25 (KIN-085, ADR-D14).
 *
 * Pendant mobile de `apps/web/src/lib/privacy/export-client.ts`. Mêmes
 * sémantiques zero-knowledge — diffère uniquement sur la lecture de la
 * variable d'env `EXPO_PUBLIC_API_URL` au lieu de `NEXT_PUBLIC_API_URL`.
 */

import type { RelayExportMetadata } from '@kinhale/reports';
import { ApiError } from '../api-client';
import { useAuthStore } from '../../stores/auth-store';

const API_BASE = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export async function getPrivacyExportMetadata(): Promise<RelayExportMetadata> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/me/privacy/export/metadata`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(
      res.status,
      typeof body['error'] === 'string' ? body['error'] : 'metadata_failed',
    );
  }
  return (await res.json()) as RelayExportMetadata;
}

export interface PrivacyExportAuditPayload {
  readonly archiveHash: string;
  readonly generatedAtMs: number;
}

export async function postPrivacyExportAudit(payload: PrivacyExportAuditPayload): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/audit/privacy-export`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(
      res.status,
      typeof body['error'] === 'string' ? body['error'] : 'audit_failed',
    );
  }
}
