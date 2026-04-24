import { ApiError } from '../api-client';
import { useAuthStore } from '../../stores/auth-store';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export interface ReportGeneratedAuditPayload {
  readonly reportHash: string;
  readonly rangeStartMs: number;
  readonly rangeEndMs: number;
  readonly generatedAtMs: number;
}

/**
 * Poste l'audit trail de génération de rapport vers le backend (E8-S05).
 *
 * **Best-effort** : en cas de 4xx/5xx, l'erreur remonte à l'appelant qui
 * choisira de :
 * - afficher un message non bloquant (rapport généré, audit en retry),
 * - stocker le payload dans une file locale pour retry ultérieur (future
 *   itération KIN-084+ : file persistée IndexedDB).
 *
 * Le payload ne contient **aucune donnée santé** (ADR-D12). Aucun contrôle
 * supplémentaire de contenu n'est appliqué ici : la responsabilité de la
 * validité du format est côté pipeline `generateMedicalReport`, qui produit
 * ces champs via des primitives pures.
 */
export async function postReportGeneratedAudit(
  payload: ReportGeneratedAuditPayload,
): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/audit/report-generated`, {
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

/**
 * Méthodes de partage valides — aligné 1:1 sur le `z.enum(...)` côté API
 * (`apps/api/src/routes/audit.ts`). Tout ajout ici doit être répliqué dans
 * le schéma Zod pour éviter un `invalid_body` en runtime.
 */
export type ShareMethod = 'download' | 'system_share' | 'csv_download' | 'csv_system_share';

export type SystemShareMethod = Extract<ShareMethod, 'system_share' | 'csv_system_share'>;

export interface ReportSharedAuditPayload {
  readonly reportHash: string;
  readonly shareMethod: ShareMethod;
  readonly sharedAtMs: number;
}

/**
 * Poste l'audit trail de **partage** de rapport (E8-S04, KIN-084).
 *
 * **Best-effort** : même sémantique que `postReportGeneratedAudit`. En cas
 * d'échec réseau (TypeError) ou 4xx/5xx (ApiError), l'appelant affiche un
 * message non bloquant. Le partage a déjà été matérialisé côté client —
 * l'audit est secondaire (ne bloque jamais l'UX utilisateur).
 *
 * **Zero-knowledge** : le payload ne contient **aucune donnée santé**.
 * - `reportHash` : hash SHA-256 opaque (RM24).
 * - `shareMethod` : identifiant d'action ; ne révèle pas le destinataire.
 * - `sharedAtMs` : timestamp équivalent à l'horloge serveur.
 *
 * Refs: ADR-D13, E8-S04.
 */
export async function postReportSharedAudit(payload: ReportSharedAuditPayload): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/audit/report-shared`, {
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
