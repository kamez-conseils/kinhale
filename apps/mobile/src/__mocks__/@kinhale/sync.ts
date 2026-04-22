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
