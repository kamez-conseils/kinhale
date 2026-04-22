import { Buffer } from 'buffer';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { getOrCreateStorageKey } from './storage-key';

type KinhaleDocument = ReturnType<typeof createDoc>;

const DOC_STORAGE_KEY = 'kinhale-doc';

/** Module-level SEK — chargé une fois lors de initDoc, jamais exposé. */
let sek: Uint8Array | null = null;

async function persistDoc(doc: KinhaleDocument): Promise<void> {
  if (sek === null) return;
  const binary = saveDoc(doc);
  const blob = await encryptDocBlob(binary, sek);
  await AsyncStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(blob));
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
    // Load (or create) the Storage Encryption Key once per session.
    sek = await getOrCreateStorageKey();

    const stored = await AsyncStorage.getItem(DOC_STORAGE_KEY);
    let doc: KinhaleDocument;

    if (stored !== null) {
      // Try parsing as encrypted JSON blob (v1 format).
      let parsed: unknown;
      try {
        parsed = JSON.parse(stored) as unknown;
      } catch {
        parsed = null;
      }

      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'version' in (parsed as object) &&
        (parsed as EncryptedBlob).version === 1
      ) {
        // New encrypted format — decrypt.
        try {
          const plaintext = await decryptDocBlob(parsed as EncryptedBlob, sek);
          doc = loadDoc(plaintext);
        } catch {
          doc = createDoc(householdId);
        }
      } else {
        // Old base64 format (v0) — migrate: read unencrypted, then re-save encrypted.
        try {
          doc = loadDoc(Buffer.from(stored, 'base64'));
          // Immediately persist in the new encrypted format.
          await persistDoc(doc);
        } catch {
          doc = createDoc(householdId);
        }
      }
    } else {
      doc = createDoc(householdId);
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
