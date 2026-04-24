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
