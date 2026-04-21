import { describe, it, expect } from 'vitest';
import { generateSigningKeypair } from '@kinhale/crypto';
import { createDoc } from '../doc/lifecycle.js';
import { signEvent } from './sign.js';
import { appendEvent } from './append.js';
import type { UnsignedEvent } from './types.js';

const makeUnsigned = (id: string): UnsignedEvent => ({
  id,
  deviceId: 'device-001',
  occurredAtMs: 1_700_000_000_000 + parseInt(id.slice(-1), 10),
  event: {
    type: 'DoseAdministered',
    payload: {
      doseId: id,
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

describe('appendEvent', () => {
  it('ajoute un SignedEventRecord au document', async () => {
    const kp = await generateSigningKeypair();
    const doc = createDoc('hh-append-1');
    const record = await signEvent(makeUnsigned('evt-1'), kp.secretKey);
    const doc2 = appendEvent(doc, record);
    expect(doc2.events).toHaveLength(1);
    expect(doc2.events[0]!.id).toBe('evt-1');
  });

  it('ne modifie pas le document original (immutabilité Automerge)', async () => {
    const kp = await generateSigningKeypair();
    const doc = createDoc('hh-append-2');
    const record = await signEvent(makeUnsigned('evt-2'), kp.secretKey);
    const doc2 = appendEvent(doc, record);
    expect(doc.events).toHaveLength(0);
    expect(doc2.events).toHaveLength(1);
  });

  it("plusieurs appendEvent préservent l'ordre d'insertion", async () => {
    const kp = await generateSigningKeypair();
    let doc = createDoc('hh-append-3');
    for (let i = 1; i <= 3; i++) {
      const record = await signEvent(makeUnsigned(`evt-${i}`), kp.secretKey);
      doc = appendEvent(doc, record);
    }
    expect(doc.events).toHaveLength(3);
    expect(doc.events[0]!.id).toBe('evt-1');
    expect(doc.events[2]!.id).toBe('evt-3');
  });
});
