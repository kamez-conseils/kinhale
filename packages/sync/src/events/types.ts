/** Types d'événements domaine persistés dans le document Automerge. */
export type DomainEventType =
  | 'DoseAdministered'
  | 'PumpReplaced'
  | 'PlanUpdated'
  | 'CaregiverInvited'
  | 'CaregiverRevoked';

/** Payload pour DoseAdministered */
export interface DoseAdministeredPayload {
  doseId: string;
  pumpId: string;
  childId: string;
  caregiverId: string;
  /** UTC ms */
  administeredAtMs: number;
  /** 'maintenance' | 'rescue' */
  doseType: string;
  dosesAdministered: number;
  symptoms: string[];
  circumstances: string[];
  freeFormTag: string | null;
}

/** Payload pour PumpReplaced */
export interface PumpReplacedPayload {
  pumpId: string;
  name: string;
  /** 'maintenance' | 'rescue' */
  pumpType: string;
  totalDoses: number;
  /** UTC ms, null si pas de date d'expiration connue */
  expiresAtMs: number | null;
}

/** Payload pour PlanUpdated */
export interface PlanUpdatedPayload {
  planId: string;
  pumpId: string;
  /** Heures cibles en UTC (ex : [8, 20]) */
  scheduledHoursUtc: number[];
  /** UTC ms */
  startAtMs: number;
  /** UTC ms, null si durée indéfinie */
  endAtMs: number | null;
}

/** Payload pour CaregiverInvited */
export interface CaregiverInvitedPayload {
  caregiverId: string;
  /** 'admin' | 'contributor' | 'restricted_contributor' */
  role: string;
  displayName: string;
}

/** Payload pour CaregiverRevoked */
export interface CaregiverRevokedPayload {
  caregiverId: string;
}

/** Union discriminée des payloads */
export type DomainEventPayload =
  | { type: 'DoseAdministered'; payload: DoseAdministeredPayload }
  | { type: 'PumpReplaced'; payload: PumpReplacedPayload }
  | { type: 'PlanUpdated'; payload: PlanUpdatedPayload }
  | { type: 'CaregiverInvited'; payload: CaregiverInvitedPayload }
  | { type: 'CaregiverRevoked'; payload: CaregiverRevokedPayload };

/**
 * Événement non signé : données à signer avant insertion dans le document.
 */
export interface UnsignedEvent {
  id: string;
  deviceId: string;
  occurredAtMs: number;
  event: DomainEventPayload;
}
