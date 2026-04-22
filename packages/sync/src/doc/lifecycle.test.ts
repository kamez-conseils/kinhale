import { describe, it, expect } from 'vitest';
import * as A from '@automerge/automerge';
import {
  createDoc,
  loadDoc,
  saveDoc,
  getDocChanges,
  getAllDocChanges,
  mergeChanges,
} from './lifecycle.js';
import type { SignedEventRecord } from './schema.js';

const makeRecord = (id: string): SignedEventRecord => ({
  id,
  type: 'DoseAdministered',
  payloadJson: '{}',
  signerPublicKeyHex: 'aa',
  signatureHex: 'bb',
  deviceId: 'dev-1',
  occurredAtMs: 1_700_000_000_000,
});

describe('Document lifecycle', () => {
  it('createDoc initialise un document avec householdId', () => {
    const doc = createDoc('hh-test-1');
    expect(doc.householdId).toBe('hh-test-1');
    expect(doc.events).toHaveLength(0);
  });

  it('saveDoc + loadDoc : aller-retour binaire', () => {
    const doc = createDoc('hh-test-2');
    const bytes = saveDoc(doc);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    const loaded = loadDoc(bytes);
    expect(loaded.householdId).toBe('hh-test-2');
    expect(loaded.events).toHaveLength(0);
  });

  it('getAllDocChanges retourne des Uint8Array non vides', () => {
    const doc = createDoc('hh-test-3');
    const changes = getAllDocChanges(doc);
    expect(Array.isArray(changes)).toBe(true);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0]).toBeInstanceOf(Uint8Array);
  });

  it('getDocChanges retourne 0 changements si doc identique', () => {
    const doc = createDoc('hh-test-4');
    const changes = getDocChanges(doc, doc);
    expect(changes).toHaveLength(0);
  });

  it('mergeChanges applique un delta sur une copie du document', () => {
    const base = createDoc('hh-merge-1');
    const copy = loadDoc(saveDoc(base));
    const updated = A.change(base, (d) => {
      d.events.push(makeRecord('evt-1'));
    });
    const delta = getDocChanges(base, updated);
    const merged = mergeChanges(copy, delta);
    expect(merged.events).toHaveLength(1);
    expect(merged.events[0]!.id).toBe('evt-1');
  });

  it('mergeChanges est idempotent (double application)', () => {
    const base = createDoc('hh-merge-2');
    const copy = loadDoc(saveDoc(base));
    const updated = A.change(base, (d) => {
      d.events.push(makeRecord('evt-2'));
    });
    const delta = getDocChanges(base, updated);
    const merged1 = mergeChanges(copy, delta);
    const merged2 = mergeChanges(merged1, delta);
    expect(merged2.events).toHaveLength(1);
  });
});
