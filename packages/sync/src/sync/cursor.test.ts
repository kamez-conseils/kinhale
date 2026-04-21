import { describe, it, expect } from 'vitest';
import { createCursor, recordSent, recordReceived, pendingChanges } from './cursor.js';
import { createDoc, getAllDocChanges } from '../doc/lifecycle.js';
import * as A from '@automerge/automerge';
import type { SignedEventRecord } from '../doc/schema.js';

const makeRecord = (id: string): SignedEventRecord => ({
  id,
  type: 'DoseAdministered',
  payloadJson: '{}',
  signerPublicKeyHex: 'a'.repeat(64),
  signatureHex: 'b'.repeat(128),
  deviceId: 'dev-1',
  occurredAtMs: 1_700_000_000_000,
});

describe('SyncCursor', () => {
  it('createCursor initialise un curseur vide', () => {
    const cursor = createCursor();
    expect(cursor.knownHeads).toHaveLength(0);
  });

  it('recordSent met à jour la tête connue', () => {
    const baseDoc = createDoc('hh-cursor-2');
    const updated = A.change(baseDoc, (d) => {
      d.events.push(makeRecord('e1'));
    });
    const cursor = createCursor();
    const cursor2 = recordSent(cursor, updated);
    expect(cursor2.knownHeads.length).toBeGreaterThan(0);
  });

  it('pendingChanges retourne [] si rien de nouveau depuis recordSent', () => {
    const doc = createDoc('hh-cursor-3');
    const cursor = recordSent(createCursor(), doc);
    const pending = pendingChanges(cursor, doc);
    expect(pending).toHaveLength(0);
  });

  it('pendingChanges retourne les changements depuis la dernière tête envoyée', () => {
    const base = createDoc('hh-cursor-4');
    const cursor = recordSent(createCursor(), base);
    const updated = A.change(base, (d) => {
      d.events.push(makeRecord('e1'));
    });
    const pending = pendingChanges(cursor, updated);
    expect(pending.length).toBeGreaterThan(0);
  });

  it('recordReceived met à jour la tête des changements reçus', () => {
    const doc = createDoc('hh-cursor-5');
    const changes = getAllDocChanges(doc);
    const cursor = createCursor();
    const cursor2 = recordReceived(cursor, changes);
    expect(cursor2.receivedCount).toBe(changes.length);
  });

  it('enchaîne sent → nouveau commit → pendingChanges → recordSent → 0 pending', () => {
    const base = createDoc('hh-cursor-6');
    let cursor = recordSent(createCursor(), base);
    const updated = A.change(base, (d) => {
      d.events.push(makeRecord('e2'));
    });
    const pending = pendingChanges(cursor, updated);
    expect(pending.length).toBeGreaterThan(0);
    cursor = recordSent(cursor, updated);
    expect(pendingChanges(cursor, updated)).toHaveLength(0);
  });
});
