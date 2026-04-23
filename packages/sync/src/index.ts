// Document Automerge
export type { KinhaleDoc, SignedEventRecord } from './doc/schema.js';
export {
  createDoc,
  loadDoc,
  saveDoc,
  getDocChanges,
  getAllDocChanges,
  mergeChanges,
} from './doc/lifecycle.js';

// Événements domaine
export type {
  DomainEventType,
  DomainEventPayload,
  UnsignedEvent,
  DoseAdministeredPayload,
  PumpReplacedPayload,
  PlanUpdatedPayload,
  CaregiverInvitedPayload,
  CaregiverAcceptedPayload,
  CaregiverRevokedPayload,
  ChildRegisteredPayload,
} from './events/types.js';
export { canonicalBytes, signEvent, verifySignedEvent } from './events/sign.js';
export { appendEvent } from './events/append.js';

// Mailbox E2EE
export type { EncryptedBlob } from './mailbox/encrypt.js';
export { encryptChanges, decryptChanges } from './mailbox/encrypt.js';
export type { SyncMessage } from './mailbox/message.js';
export { encodeSyncMessage, decodeSyncMessage } from './mailbox/message.js';

// Pipeline haut-niveau
export type { SyncMeta } from './mailbox/pipeline.js';
export { buildSyncMessage, consumeSyncMessage } from './mailbox/pipeline.js';

// Cursor de synchronisation
export type { SyncCursor } from './sync/cursor.js';
export { createCursor, recordSent, recordReceived, pendingChanges } from './sync/cursor.js';

// Projections
export type { ProjectedCaregiver } from './projections/caregivers.js';
export { projectCaregivers } from './projections/caregivers.js';
export type { ProjectedChild } from './projections/child.js';
export { projectChild } from './projections/child.js';
export type { ProjectedDose } from './projections/doses.js';
export { projectDoses } from './projections/doses.js';
export type { ProjectedPlan } from './projections/plan.js';
export { projectPlan } from './projections/plan.js';
export type { ProjectedPump } from './projections/pumps.js';
export { projectPumps } from './projections/pumps.js';
export {
  DEFAULT_REMINDER_HORIZON_MS,
  DEFAULT_REMINDER_LOOKBACK_MS,
  projectScheduledReminders,
  REMINDER_WINDOW_AFTER_MS,
  REMINDER_WINDOW_BEFORE_MS,
} from './projections/reminders.js';
