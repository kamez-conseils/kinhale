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
  CaregiverRevokedPayload,
} from './events/types.js';
export { canonicalBytes, signEvent, verifySignedEvent } from './events/sign.js';
export { appendEvent } from './events/append.js';

// Mailbox E2EE
export type { EncryptedBlob } from './mailbox/encrypt.js';
export { encryptChanges, decryptChanges } from './mailbox/encrypt.js';
export type { SyncMessage } from './mailbox/message.js';
export { encodeSyncMessage, decodeSyncMessage } from './mailbox/message.js';
