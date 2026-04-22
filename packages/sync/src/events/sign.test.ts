import { describe, it, expect } from 'vitest';
import { generateSigningKeypair } from '@kinhale/crypto';
import { signEvent, verifySignedEvent, canonicalBytes } from './sign.js';
import type { UnsignedEvent } from './types.js';

const makeUnsigned = (): UnsignedEvent => ({
  id: 'evt-sign-1',
  deviceId: 'device-001',
  occurredAtMs: 1_700_000_000_000,
  event: {
    type: 'DoseAdministered',
    payload: {
      doseId: 'd1',
      pumpId: 'p1',
      childId: 'c1',
      caregiverId: 'cg1',
      administeredAtMs: 1_700_000_000_000,
      doseType: 'maintenance',
      dosesAdministered: 1,
      symptoms: [],
      circumstances: [],
      freeFormTag: null,
    },
  },
});

describe('Event signing', () => {
  it('signEvent produit un SignedEventRecord avec signatureHex non vide', async () => {
    const kp = await generateSigningKeypair();
    const record = await signEvent(makeUnsigned(), kp.secretKey);
    expect(record.id).toBe('evt-sign-1');
    expect(record.type).toBe('DoseAdministered');
    expect(record.signatureHex).toHaveLength(128); // 64 bytes Ed25519 → 128 hex chars
    expect(record.signerPublicKeyHex).toHaveLength(64); // 32 bytes → 64 hex chars
    expect(record.deviceId).toBe('device-001');
  });

  it('verifySignedEvent retourne true pour une signature valide', async () => {
    const kp = await generateSigningKeypair();
    const record = await signEvent(makeUnsigned(), kp.secretKey);
    const valid = await verifySignedEvent(record);
    expect(valid).toBe(true);
  });

  it('verifySignedEvent retourne false si le payload est altéré', async () => {
    const kp = await generateSigningKeypair();
    const record = await signEvent(makeUnsigned(), kp.secretKey);
    const tampered = { ...record, payloadJson: JSON.stringify({ doseId: 'HACKED' }) };
    const valid = await verifySignedEvent(tampered);
    expect(valid).toBe(false);
  });

  it('verifySignedEvent retourne false si la signature est corrompue', async () => {
    const kp = await generateSigningKeypair();
    const record = await signEvent(makeUnsigned(), kp.secretKey);
    const corrupted = { ...record, signatureHex: 'a'.repeat(128) };
    const valid = await verifySignedEvent(corrupted);
    expect(valid).toBe(false);
  });

  it('deux signEvent sur le même UnsignedEvent produisent la même signature', async () => {
    const kp = await generateSigningKeypair();
    const unsigned = makeUnsigned();
    const r1 = await signEvent(unsigned, kp.secretKey);
    const r2 = await signEvent(unsigned, kp.secretKey);
    expect(r1.signatureHex).toBe(r2.signatureHex);
  });

  it('canonicalBytes est déterministe', () => {
    const unsigned = makeUnsigned();
    const b1 = canonicalBytes(unsigned);
    const b2 = canonicalBytes(unsigned);
    expect(Buffer.from(b1).toString('hex')).toBe(Buffer.from(b2).toString('hex'));
  });
});
