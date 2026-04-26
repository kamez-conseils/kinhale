/**
 * Stub Jest mobile du package racine `@kinhale/sync`.
 *
 * - Désactive le pipeline E2EE réel (Automerge + libsodium) pour le code
 *   applicatif mobile qui importe directement `@kinhale/sync` (ex: doc-store,
 *   use-relay et leurs tests via `jest.mock('@kinhale/sync')`).
 * - La logique réelle est couverte par les tests vitest du package
 *   (packages/sync/src sous-dossiers __tests__), pas rejouée ici.
 * - Cette désactivation évite la complexité de mocker WebSocket / crypto /
 *   stores en environnement jsdom côté mobile.
 * - Couverture d'intégration RN réelle à compenser en e2e Maestro (ticket de
 *   suivi Sprint 5-6).
 */
export const createDoc = jest.fn().mockReturnValue({ householdId: 'hh-1', events: [] });
export const loadDoc = jest.fn().mockReturnValue({ householdId: 'hh-1', events: [] });
export const saveDoc = jest.fn().mockReturnValue(new Uint8Array(10));
export const getDocChanges = jest.fn().mockReturnValue([new Uint8Array(5)]);
export const getAllDocChanges = jest.fn().mockReturnValue([new Uint8Array(5)]);
export const mergeChanges = jest.fn().mockReturnValue({ householdId: 'hh-1', events: [] });
export const signEvent = jest.fn().mockResolvedValue({
  id: 'ev-1',
  deviceId: 'dev-1',
  occurredAtMs: 0,
  signature: 'sig',
  event: {},
});
export const appendEvent = jest.fn().mockReturnValue({ householdId: 'hh-1', events: [] });
export const encryptChanges = jest.fn().mockResolvedValue('encrypted-blob');
export const decryptChanges = jest.fn().mockResolvedValue([new Uint8Array(5)]);
export const canonicalBytes = jest.fn().mockReturnValue(new Uint8Array(10));
export const verifySignedEvent = jest.fn().mockReturnValue(true);
export const encodeSyncMessage = jest.fn().mockReturnValue(new Uint8Array(10));
export const decodeSyncMessage = jest.fn().mockReturnValue({ changes: [new Uint8Array(5)] });
export const buildSyncMessage = jest.fn().mockResolvedValue(new Uint8Array(10));
export const consumeSyncMessage = jest.fn().mockResolvedValue({ householdId: 'hh-1', events: [] });
export const createCursor = jest.fn().mockReturnValue({ lastSentSeq: 0, lastReceivedSeq: 0 });
export const recordSent = jest.fn().mockReturnValue({ lastSentSeq: 1, lastReceivedSeq: 0 });
export const recordReceived = jest.fn().mockReturnValue({ lastSentSeq: 0, lastReceivedSeq: 1 });
export const pendingChanges = jest.fn().mockReturnValue([new Uint8Array(5)]);
export const projectDoses = jest.fn().mockReturnValue([]);
export const projectPumps = jest.fn().mockReturnValue([]);
export const projectChild = jest.fn().mockReturnValue(null);
export const projectPlan = jest.fn().mockReturnValue(null);
export const projectCaregivers = jest.fn().mockReturnValue([]);
export const VOIDED_REASON_DUPLICATE_RESOLVED = 'duplicate_resolved';
export const VOIDED_REASON_MAX_LENGTH = 200;
