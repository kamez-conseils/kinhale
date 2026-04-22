import type { KinhaleDoc } from '../doc/schema.js';

export interface ProjectedCaregiver {
  caregiverId: string;
  role: string;
  displayName: string;
  status: 'invited' | 'active';
  invitedAtMs: number;
  acceptedAtMs: number | null;
}

/**
 * Projette la liste des aidants actifs à partir des événements
 * CaregiverInvited + CaregiverAccepted − CaregiverRevoked.
 * Un aidant révoqué n'apparaît plus dans la liste.
 */
export function projectCaregivers(doc: KinhaleDoc): ProjectedCaregiver[] {
  const byId = new Map<string, ProjectedCaregiver>();
  const revoked = new Set<string>();

  for (const ev of doc.events) {
    try {
      if (ev.type === 'CaregiverInvited') {
        const p = JSON.parse(ev.payloadJson) as { caregiverId: string; role: string; displayName: string };
        if (typeof p.caregiverId !== 'string' || typeof p.role !== 'string' || typeof p.displayName !== 'string') continue;
        byId.set(p.caregiverId, {
          caregiverId: p.caregiverId,
          role: p.role,
          displayName: p.displayName,
          status: 'invited',
          invitedAtMs: ev.occurredAtMs,
          acceptedAtMs: null,
        });
      } else if (ev.type === 'CaregiverAccepted') {
        const p = JSON.parse(ev.payloadJson) as { caregiverId: string; acceptedAtMs: number };
        if (typeof p.caregiverId !== 'string' || typeof p.acceptedAtMs !== 'number') continue;
        const existing = byId.get(p.caregiverId);
        if (existing !== undefined) {
          byId.set(p.caregiverId, { ...existing, status: 'active', acceptedAtMs: p.acceptedAtMs });
        }
      } else if (ev.type === 'CaregiverRevoked') {
        const p = JSON.parse(ev.payloadJson) as { caregiverId: string };
        if (typeof p.caregiverId === 'string') revoked.add(p.caregiverId);
      }
    } catch {
      /* payload invalide — ignore */
    }
  }

  return [...byId.values()].filter((c) => !revoked.has(c.caregiverId));
}
