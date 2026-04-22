import { create } from 'zustand';
import {
  createDoc,
  loadDoc,
  saveDoc,
  getDocChanges,
  mergeChanges,
  signEvent,
  appendEvent,
} from '@kinhale/sync';
import type {
  KinhaleDoc,
  DoseAdministeredPayload,
  ChildRegisteredPayload,
  PumpReplacedPayload,
  PlanUpdatedPayload,
  UnsignedEvent,
} from '@kinhale/sync';
import { encryptDocBlob, decryptDocBlob } from '@kinhale/crypto';
import type { EncryptedBlob } from '@kinhale/crypto';
import { getOrCreateStorageKey, readEncryptedDoc, writeEncryptedDoc } from './storage-key';

type KinhaleDocument = ReturnType<typeof createDoc>;

/** Clé de chiffrement du stockage — chargée une seule fois dans initDoc. */
let sek: Uint8Array | null = null;

async function persistDoc(doc: KinhaleDocument): Promise<void> {
  if (sek === null) return;
  const binary = saveDoc(doc);
  const blob = await encryptDocBlob(binary, sek);
  await writeEncryptedDoc(blob);
}

interface DocState {
  doc: KinhaleDocument | null;
  initDoc: (householdId: string) => Promise<void>;
  appendDose: (
    payload: DoseAdministeredPayload,
    deviceId: string,
    secretKey: Uint8Array,
  ) => Promise<Uint8Array[]>;
  appendChild: (
    payload: ChildRegisteredPayload,
    deviceId: string,
    secretKey: Uint8Array,
  ) => Promise<Uint8Array[]>;
  appendPump: (
    payload: PumpReplacedPayload,
    deviceId: string,
    secretKey: Uint8Array,
  ) => Promise<Uint8Array[]>;
  appendPlan: (
    payload: PlanUpdatedPayload,
    deviceId: string,
    secretKey: Uint8Array,
  ) => Promise<Uint8Array[]>;
  receiveChanges: (changes: Uint8Array[]) => void;
}

export const useDocStore = create<DocState>()((set, get) => ({
  doc: null,

  async initDoc(householdId) {
    // Charge (ou crée) la Storage Encryption Key une seule fois par session.
    sek = await getOrCreateStorageKey();

    const stored = await readEncryptedDoc();
    let doc: KinhaleDocument;

    if (stored !== null) {
      // Entrée IndexedDB présente — doit être un EncryptedBlob v1.
      if (
        typeof stored === 'object' &&
        'version' in (stored as object) &&
        (stored as EncryptedBlob).version === 1
      ) {
        try {
          const plaintext = await decryptDocBlob(stored as EncryptedBlob, sek);
          doc = loadDoc(plaintext);
        } catch {
          doc = createDoc(householdId);
        }
      } else {
        // Format inattendu — on repart de zéro.
        doc = createDoc(householdId);
      }
    } else {
      // Aucune entrée IDB. Vérifie si une migration depuis localStorage est nécessaire.
      const legacy = localStorage.getItem('kinhale-doc');
      if (legacy !== null) {
        // Migration : doc base64 non chiffré → IDB chiffré.
        try {
          doc = loadDoc(Buffer.from(legacy, 'base64'));
          await persistDoc(doc);
          localStorage.removeItem('kinhale-doc');
        } catch {
          doc = createDoc(householdId);
        }
      } else {
        doc = createDoc(householdId);
        await persistDoc(doc);
      }
    }

    set({ doc });
  },

  async appendDose(payload, deviceId, secretKey) {
    const currentDoc = get().doc;
    const hid = (currentDoc as KinhaleDoc | null)?.householdId ?? deviceId;
    const doc = currentDoc ?? createDoc(hid);

    const unsigned: UnsignedEvent = {
      id: crypto.randomUUID(),
      deviceId,
      occurredAtMs: Date.now(),
      event: { type: 'DoseAdministered', payload },
    };
    const record = await signEvent(unsigned, secretKey);
    const newDoc = appendEvent(doc, record);
    const changes = getDocChanges(doc, newDoc);

    void persistDoc(newDoc);
    set({ doc: newDoc });
    return changes;
  },

  async appendChild(payload, deviceId, secretKey) {
    const currentDoc = get().doc;
    const hid = (currentDoc as KinhaleDoc | null)?.householdId ?? deviceId;
    const doc = currentDoc ?? createDoc(hid);

    const unsigned: UnsignedEvent = {
      id: crypto.randomUUID(),
      deviceId,
      occurredAtMs: Date.now(),
      event: { type: 'ChildRegistered', payload },
    };
    const record = await signEvent(unsigned, secretKey);
    const newDoc = appendEvent(doc, record);
    const changes = getDocChanges(doc, newDoc);

    void persistDoc(newDoc);
    set({ doc: newDoc });
    return changes;
  },

  async appendPump(payload, deviceId, secretKey) {
    const currentDoc = get().doc;
    const hid = (currentDoc as KinhaleDoc | null)?.householdId ?? deviceId;
    const doc = currentDoc ?? createDoc(hid);

    const unsigned: UnsignedEvent = {
      id: crypto.randomUUID(),
      deviceId,
      occurredAtMs: Date.now(),
      event: { type: 'PumpReplaced', payload },
    };
    const record = await signEvent(unsigned, secretKey);
    const newDoc = appendEvent(doc, record);
    const changes = getDocChanges(doc, newDoc);

    void persistDoc(newDoc);
    set({ doc: newDoc });
    return changes;
  },

  async appendPlan(payload, deviceId, secretKey) {
    const currentDoc = get().doc;
    const hid = (currentDoc as KinhaleDoc | null)?.householdId ?? deviceId;
    const doc = currentDoc ?? createDoc(hid);

    const unsigned: UnsignedEvent = {
      id: crypto.randomUUID(),
      deviceId,
      occurredAtMs: Date.now(),
      event: { type: 'PlanUpdated', payload },
    };
    const record = await signEvent(unsigned, secretKey);
    const newDoc = appendEvent(doc, record);
    const changes = getDocChanges(doc, newDoc);

    void persistDoc(newDoc);
    set({ doc: newDoc });
    return changes;
  },

  receiveChanges(changes) {
    const doc = get().doc;
    if (doc === null) return;
    const newDoc = mergeChanges(doc, changes);
    void persistDoc(newDoc);
    set({ doc: newDoc });
  },
}));
