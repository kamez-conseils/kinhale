/**
 * Client web pour l'export de portabilité RGPD/Loi 25 (KIN-085, ADR-D14).
 *
 * Encapsule deux appels HTTP au relais :
 * - `GET /me/privacy/export/metadata` : récupère les métadonnées non-santé
 *   du compte courant (devices, audit events, prefs, quiet hours, push tokens
 *   count). Aucune donnée santé n'est jamais retournée par cet endpoint.
 * - `POST /audit/privacy-export` : trace la génération côté audit. Best-effort.
 *
 * Les types retournés sont alignés sur `RelayExportMetadata` du package
 * `@kinhale/reports` — toute désynchronisation déclenche une erreur de
 * compilation côté `apps/web`.
 */

import type { RelayExportMetadata } from '@kinhale/reports';
import { ApiError } from '../api-client';
import { useAuthStore } from '../../stores/auth-store';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

/**
 * Fetche les métadonnées relais — JWT obligatoire (filtre `WHERE accountId =
 * sub`). En cas de 401/429/5xx, l'erreur remonte à l'appelant qui peut
 * afficher un message i18n adéquat.
 */
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

/**
 * Trace côté backend la génération locale d'une archive RGPD/Loi 25.
 *
 * **Best-effort** : si l'audit échoue (network, rate-limit), l'archive est
 * déjà sur le device de l'utilisateur — on ne bloque pas l'UX. L'appelant
 * affiche un message non bloquant.
 *
 * **Zero-knowledge** : le payload ne contient AUCUNE donnée santé.
 */
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
