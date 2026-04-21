import { describe, it, expect } from 'vitest';
import type { KinhaleDoc, SignedEventRecord } from './schema.js';

describe('KinhaleDoc schema', () => {
  it('SignedEventRecord a toutes les propriétés requises', () => {
    const record: SignedEventRecord = {
      id: 'evt-001',
      type: 'DoseAdministered',
      payloadJson: JSON.stringify({ doseId: 'd1' }),
      signerPublicKeyHex: 'aabbcc',
      signatureHex: 'ddeeff',
      deviceId: 'device-001',
      occurredAtMs: 1_700_000_000_000,
    };
    expect(record.id).toBe('evt-001');
    expect(record.type).toBe('DoseAdministered');
    expect(record.occurredAtMs).toBeGreaterThan(0);
  });

  it('KinhaleDoc a householdId et events', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-001',
      events: [],
    };
    expect(doc.householdId).toBe('hh-001');
    expect(doc.events).toHaveLength(0);
  });
});
