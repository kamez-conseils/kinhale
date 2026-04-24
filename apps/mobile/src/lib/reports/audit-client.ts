import { apiFetch, ApiError } from '../api-client';
import { useAuthStore } from '../../stores/auth-store';

export interface ReportGeneratedAuditPayload {
  readonly reportHash: string;
  readonly rangeStartMs: number;
  readonly rangeEndMs: number;
  readonly generatedAtMs: number;
}

/**
 * Poste l'audit trail de génération (E8-S05) vers `/audit/report-generated`.
 *
 * **Best-effort** : toute erreur réseau ou 4xx/5xx remonte à l'appelant. Le
 * payload ne contient **aucune** donnée santé (ADR-D12). En offline, le
 * client peut choisir d'afficher un état « audit en attente » et retenter
 * plus tard (aucune file persistée dans le scope KIN-083).
 */
export async function postReportGeneratedAudit(
  payload: ReportGeneratedAuditPayload,
): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  try {
    await apiFetch<{ ok: boolean }>('/audit/report-generated', {
      method: 'POST',
      body: JSON.stringify(payload),
      ...(token !== null ? { token } : {}),
    });
  } catch (err) {
    // Re-throw tel quel — l'appelant distingue ApiError (4xx/5xx) des
    // TypeError réseau pour afficher le bon message.
    if (err instanceof ApiError) throw err;
    throw err;
  }
}
