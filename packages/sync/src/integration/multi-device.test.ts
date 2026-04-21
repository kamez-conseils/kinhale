// packages/sync/src/integration/multi-device.test.ts
import { describe, it, expect } from 'vitest';
import { deriveDeviceKeypair, generateSeedPhrase, secretboxKeygen } from '@kinhale/crypto';
import * as A from '@automerge/automerge';
import { createDoc, loadDoc, saveDoc } from '../doc/lifecycle.js';
import { signEvent } from '../events/sign.js';
import { appendEvent } from '../events/append.js';
import { buildSyncMessage, consumeSyncMessage } from '../mailbox/pipeline.js';
import { verifySignedEvent } from '../events/sign.js';
import type { UnsignedEvent } from '../events/types.js';
import type { KinhaleDoc } from '../doc/schema.js';

const makeUnsigned = (id: string, deviceId: string): UnsignedEvent => ({
  id,
  deviceId,
  occurredAtMs: 1_700_000_000_000 + parseInt(id.slice(-1), 10),
  event: {
    type: 'DoseAdministered',
    payload: {
      doseId: id,
      pumpId: 'pump-1',
      childId: 'child-1',
      caregiverId: deviceId,
      administeredAtMs: 1_700_000_000_000,
      doseType: 'maintenance',
      dosesAdministered: 1,
      symptoms: [],
      circumstances: [],
      freeFormTag: null,
    },
  },
});

describe('Multi-device sync (intégration)', () => {
  it('deux devices convergent via buildSyncMessage / consumeSyncMessage', async () => {
    // Deux clés de groupe partagées (en production : établies via MLS)
    const groupKey = await secretboxKeygen();

    // Device Alice : dérive son keypair depuis son seed
    const aliceSeed = generateSeedPhrase();
    const aliceKp = await deriveDeviceKeypair(aliceSeed);

    // Device Bob : dérive son keypair depuis son seed
    const bobSeed = generateSeedPhrase();
    const bobKp = await deriveDeviceKeypair(bobSeed);

    // Foyer initial : les deux devices partent du même document
    const householdBase = createDoc('hh-integration-1');
    let aliceDoc = householdBase;
    let bobDoc = loadDoc(saveDoc(householdBase));

    // Alice signe et ajoute un événement
    const aliceEvent = await signEvent(
      makeUnsigned('evt-alice-1', 'device-alice'),
      aliceKp.signing.secretKey,
    );
    aliceDoc = appendEvent(aliceDoc, aliceEvent);

    // Alice envoie ses changements au relay
    const msgAliceToBob = await buildSyncMessage(householdBase, aliceDoc, groupKey, {
      mailboxId: 'mailbox-hh-1',
      deviceId: 'device-alice',
      seq: 1,
    });
    expect(msgAliceToBob).not.toBeNull();

    // Bob reçoit et applique les changements
    bobDoc = await consumeSyncMessage(bobDoc, msgAliceToBob!, groupKey);
    expect(bobDoc.events).toHaveLength(1);
    expect(bobDoc.events[0]!.id).toBe('evt-alice-1');

    // Bob vérifie la signature d'Alice sur l'événement reçu
    const valid = await verifySignedEvent(bobDoc.events[0]!);
    expect(valid).toBe(true);

    // Bob signe et ajoute son propre événement
    const bobEvent = await signEvent(
      makeUnsigned('evt-bob-1', 'device-bob'),
      bobKp.signing.secretKey,
    );
    bobDoc = appendEvent(bobDoc, bobEvent);

    // Bob envoie ses changements (delta depuis aliceDoc qui inclut evt-alice-1)
    const msgBobToAlice = await buildSyncMessage(aliceDoc, bobDoc, groupKey, {
      mailboxId: 'mailbox-hh-1',
      deviceId: 'device-bob',
      seq: 1,
    });
    expect(msgBobToAlice).not.toBeNull();

    // Alice reçoit les changements de Bob
    aliceDoc = await consumeSyncMessage(aliceDoc, msgBobToAlice!, groupKey);

    // Les deux documents convergent
    expect(aliceDoc.events).toHaveLength(2);
    expect(bobDoc.events).toHaveLength(2);
    expect(aliceDoc.events[0]!.id).toBe('evt-alice-1');
    expect(aliceDoc.events[1]!.id).toBe('evt-bob-1');
  }, 30_000);

  it('la signature est liée au device (clé différente → signature différente)', async () => {
    const aliceSeed = generateSeedPhrase();
    const bobSeed = generateSeedPhrase();
    const aliceKp = await deriveDeviceKeypair(aliceSeed);
    const bobKp = await deriveDeviceKeypair(bobSeed);

    const unsigned = makeUnsigned('evt-sign-1', 'device-test');
    const aliceRecord = await signEvent(unsigned, aliceKp.signing.secretKey);
    const bobRecord = await signEvent(unsigned, bobKp.signing.secretKey);

    expect(aliceRecord.signatureHex).not.toBe(bobRecord.signatureHex);
    expect(aliceRecord.signerPublicKeyHex).not.toBe(bobRecord.signerPublicKeyHex);

    // Chaque signature valide avec sa propre clé publique
    expect(await verifySignedEvent(aliceRecord)).toBe(true);
    expect(await verifySignedEvent(bobRecord)).toBe(true);
  }, 30_000);

  it('restauration device : rejouer tous les changements sur un nouveau device', async () => {
    const groupKey = await secretboxKeygen();
    const aliceSeed = generateSeedPhrase();
    const aliceKp = await deriveDeviceKeypair(aliceSeed);

    // Alice construit un historique de 3 événements
    const base = createDoc('hh-restore-1');
    let aliceDoc = base;
    for (let i = 1; i <= 3; i++) {
      const record = await signEvent(
        makeUnsigned(`evt-${i}`, 'device-alice'),
        aliceKp.signing.secretKey,
      );
      aliceDoc = appendEvent(aliceDoc, record);
    }

    // Alice envoie tout depuis l'origine (full sync initial depuis doc vide)
    // A.init() comme base garantit que TOUS les changements sont inclus,
    // y compris le premier (createDoc), pour un nouveau device sans historique.
    const fullSync = await buildSyncMessage(A.init<KinhaleDoc>(), aliceDoc, groupKey, {
      mailboxId: 'mailbox-restore-1',
      deviceId: 'device-alice',
      seq: 1,
    });
    expect(fullSync).not.toBeNull();

    // Nouveau device (restauré depuis le même seed BIP39)
    const aliceKpRestored = await deriveDeviceKeypair(aliceSeed);
    expect(Buffer.from(aliceKpRestored.signing.publicKey).toString('hex')).toBe(
      Buffer.from(aliceKp.signing.publicKey).toString('hex'),
    );

    // Le nouveau device part d'un doc vide et reçoit tout l'historique
    const newDevice = A.init<KinhaleDoc>();
    const restored = await consumeSyncMessage(newDevice, fullSync!, groupKey);
    expect(restored.events).toHaveLength(3);

    // Toutes les signatures sont valides
    for (const event of restored.events) {
      expect(await verifySignedEvent(event)).toBe(true);
    }
  }, 60_000);
});
