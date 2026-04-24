/** Types d'événements domaine persistés dans le document Automerge. */
export type DomainEventType =
  | 'DoseAdministered'
  | 'DoseReviewFlagged'
  | 'PumpReplaced'
  | 'PlanUpdated'
  | 'CaregiverInvited'
  | 'CaregiverAccepted'
  | 'CaregiverRevoked'
  | 'ChildRegistered';

/** Payload pour DoseAdministered */
export interface DoseAdministeredPayload {
  doseId: string;
  pumpId: string;
  childId: string;
  caregiverId: string;
  /** UTC ms */
  administeredAtMs: number;
  doseType: 'maintenance' | 'rescue';
  dosesAdministered: number;
  symptoms: string[];
  circumstances: string[];
  freeFormTag: string | null;
}

/**
 * Payload pour DoseReviewFlagged — RM6 (§4).
 *
 * Émis par le `useDuplicateDetectionWatcher` quand il détecte une paire de
 * prises du même type sur la même pompe séparées de moins de 2 min.
 * Référence les deux doses ; la projection `projectDoses` marque chacune
 * comme `pending_review` dès qu'un flag existe.
 *
 * Idempotence : plusieurs flags pour la même paire (ordre inversé ou non)
 * sont tolérés — la projection dédoublonne par `doseId`. Le watcher évite
 * néanmoins les duplications via un cache local (`flaggedPairsRef`).
 */
export interface DoseReviewFlaggedPayload {
  /** Identifiant unique du flag (UUID v4). */
  flagId: string;
  /** Les deux prises en conflit, **triées par doseId** pour canonicalité. */
  doseIds: [string, string];
  /** Instant de détection (UTC ms). */
  detectedAtMs: number;
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

/** Payload pour CaregiverAccepted */
export interface CaregiverAcceptedPayload {
  caregiverId: string;
  invitationId: string;
  /** UTC ms — moment d'acceptation confirmé côté API */
  acceptedAtMs: number;
  /** Device de l'aidant qui accepte */
  deviceId: string;
}

/** Payload pour CaregiverRevoked */
export interface CaregiverRevokedPayload {
  caregiverId: string;
}

/** Payload pour ChildRegistered */
export interface ChildRegisteredPayload {
  childId: string;
  firstName: string;
  /** Année de naissance (pas la date exacte pour minimiser les données personnelles) */
  birthYear: number;
}

/** Union discriminée des payloads */
export type DomainEventPayload =
  | { type: 'DoseAdministered'; payload: DoseAdministeredPayload }
  | { type: 'DoseReviewFlagged'; payload: DoseReviewFlaggedPayload }
  | { type: 'PumpReplaced'; payload: PumpReplacedPayload }
  | { type: 'PlanUpdated'; payload: PlanUpdatedPayload }
  | { type: 'CaregiverInvited'; payload: CaregiverInvitedPayload }
  | { type: 'CaregiverAccepted'; payload: CaregiverAcceptedPayload }
  | { type: 'CaregiverRevoked'; payload: CaregiverRevokedPayload }
  | { type: 'ChildRegistered'; payload: ChildRegisteredPayload };

/**
 * Événement non signé : données à signer avant insertion dans le document.
 */
export interface UnsignedEvent {
  id: string;
  deviceId: string;
  occurredAtMs: number;
  event: DomainEventPayload;
}
