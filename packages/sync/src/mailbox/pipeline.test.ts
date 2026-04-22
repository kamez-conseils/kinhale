import { describe, it, expect } from 'vitest';
import { secretboxKeygen } from '@kinhale/crypto';
import { createDoc, loadDoc, saveDoc } from '../doc/lifecycle.js';
import { buildSyncMessage, consumeSyncMessage } from './pipeline.js';
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

describe('buildSyncMessage', () => {
  it('retourne null si aucun changement (before === after)', async () => {
    const key = await secretboxKeygen();
    const doc = createDoc('hh-pipeline-1');
    const result = await buildSyncMessage(doc, doc, key, {
      mailboxId: 'mb-1',
      deviceId: 'dev-1',
      seq: 1,
    });
    expect(result).toBeNull();
  });

  it('retourne un SyncMessage JSON encodé si des changements existent', async () => {
    const key = await secretboxKeygen();
    const before = createDoc('hh-pipeline-2');
    const after = A.change(before, (d) => {
      d.events.push(makeRecord('e1'));
    });
    const result = await buildSyncMessage(before, after, key, {
      mailboxId: 'mb-2',
      deviceId: 'dev-2',
      seq: 1,
    });
    expect(typeof result).toBe('string');
    const parsed = JSON.parse(result!);
    expect(parsed.mailboxId).toBe('mb-2');
    expect(parsed.deviceId).toBe('dev-2');
    expect(parsed.seq).toBe(1);
    expect(typeof parsed.blob.nonce).toBe('string');
  });
});

describe('consumeSyncMessage', () => {
  it('applique les changements et retourne le document mis à jour', async () => {
    const key = await secretboxKeygen();
    const base = createDoc('hh-pipeline-3');
    const sender = A.change(base, (d) => {
      d.events.push(makeRecord('e1'));
    });
    const json = await buildSyncMessage(base, sender, key, {
      mailboxId: 'mb-3',
      deviceId: 'dev-3',
      seq: 1,
    });
    expect(json).not.toBeNull();

    const receiver = loadDoc(saveDoc(base));
    const updated = await consumeSyncMessage(receiver, json!, key);
    expect(updated.events).toHaveLength(1);
    expect(updated.events[0]!.id).toBe('e1');
  });

  it('throw si la clé de déchiffrement est incorrecte', async () => {
    const key1 = await secretboxKeygen();
    const key2 = await secretboxKeygen();
    const base = createDoc('hh-pipeline-4');
    const after = A.change(base, (d) => {
      d.events.push(makeRecord('e2'));
    });
    const json = await buildSyncMessage(base, after, key1, {
      mailboxId: 'mb-4',
      deviceId: 'dev-4',
      seq: 1,
    });
    await expect(consumeSyncMessage(base, json!, key2)).rejects.toThrow();
  });

  it('round-trip : buildSyncMessage → consumeSyncMessage → document convergé', async () => {
    const key = await secretboxKeygen();
    const base = createDoc('hh-pipeline-5');
    let alice = base;
    let bob = loadDoc(saveDoc(base));

    // Alice ajoute 2 événements
    alice = A.change(alice, (d) => {
      d.events.push(makeRecord('e1'));
    });
    alice = A.change(alice, (d) => {
      d.events.push(makeRecord('e2'));
    });

    const json = await buildSyncMessage(base, alice, key, {
      mailboxId: 'mb-5',
      deviceId: 'alice',
      seq: 1,
    });
    bob = await consumeSyncMessage(bob, json!, key);
    expect(bob.events).toHaveLength(2);
    expect(bob.events[0]!.id).toBe('e1');
    expect(bob.events[1]!.id).toBe('e2');
  });
});
