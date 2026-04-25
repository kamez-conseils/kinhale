/** Types d'événements domaine persistés dans le document Automerge. */
export type DomainEventType =
  | 'DoseAdministered'
  | 'DoseReviewFlagged'
  | 'DoseEdited'
  | 'DoseVoided'
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

/**
 * Constante de raison d'annulation pour les doses résolues via le flux de
 * conflit RM6 (E4-S05). La présence de cette valeur permet à l'UI de
 * distinguer une annulation issue d'une résolution de conflit d'un void
 * manuel libellé par l'utilisateur.
 */
export const VOIDED_REASON_DUPLICATE_RESOLVED = 'duplicate_resolved';

/**
 * Longueur maximale du `voidedReason` en caractères. Dimensionnée pour la
 * saisie courte (cf. CLAUDE.md §contraintes E4-S07). Toute valeur excédant
 * cette borne doit être rejetée par le validateur Zod côté UI **et** par le
 * projector qui l'ignore (le statut reste `recorded`).
 */
export const VOIDED_REASON_MAX_LENGTH = 200;

/**
 * Payload pour `DoseEdited` — RM18, E4-S06.
 *
 * Patch immuable d'un sous-ensemble de champs métier d'une `DoseAdministered`
 * existante. L'événement original n'est jamais modifié : la projection
 * applique le dernier patch reçu pour le `doseId` lors de la dérivation
 * (audit trail intact).
 *
 * Les champs absents du `patch` ne sont pas modifiés. Un `patch` totalement
 * vide est ignoré par la projection.
 */
export interface DoseEditedPayload {
  /** Référence vers la `DoseAdministered` à patcher. */
  doseId: string;
  /** Champs modifiables (tous optionnels, au moins un attendu). */
  patch: {
    administeredAtMs?: number;
    dosesAdministered?: number;
    symptoms?: ReadonlyArray<string>;
    circumstances?: ReadonlyArray<string>;
    freeFormTag?: string | null;
  };
  /** Device qui a effectué l'édition. */
  editedByDeviceId: string;
  /** UTC ms de l'édition. */
  editedAtMs: number;
  /**
   * Raison obligatoire si l'éditeur est Admin et que > 30 min se sont
   * écoulées depuis `administeredAtMs`. Optionnel sinon.
   */
  reason?: string;
}

/**
 * Payload pour `DoseVoided` — RM18, E4-S07.
 *
 * Marque une prise comme annulée logiquement (gris barré, hors décompte
 * pompe). La prise originale n'est jamais supprimée physiquement : l'audit
 * trail conserve le `DoseAdministered` initial et l'événement `DoseVoided`
 * en parallèle.
 *
 * Pour le flux de résolution de conflit (E4-S05), `voidedReason` doit valoir
 * `VOIDED_REASON_DUPLICATE_RESOLVED` (constante exportée par ce module).
 */
export interface DoseVoidedPayload {
  doseId: string;
  voidedByDeviceId: string;
  /** UTC ms de l'annulation. */
  voidedAtMs: number;
  /**
   * Raison obligatoire (max 200 chars). Pour une résolution de conflit RM6,
   * vaut la constante `VOIDED_REASON_DUPLICATE_RESOLVED`.
   */
  voidedReason: string;
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
  | { type: 'DoseEdited'; payload: DoseEditedPayload }
  | { type: 'DoseVoided'; payload: DoseVoidedPayload }
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
