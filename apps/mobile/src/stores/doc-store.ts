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

type KinhaleDocument = ReturnType<typeof createDoc>;

const DOC_STORAGE_KEY = 'kinhale-doc';

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

async function persistDoc(doc: KinhaleDocument): Promise<void> {
  const binary = saveDoc(doc);
  await AsyncStorage.setItem(DOC_STORAGE_KEY, Buffer.from(binary).toString('base64'));
}

export const useDocStore = create<DocState>()((set, get) => ({
  doc: null,

  async initDoc(householdId) {
    const stored = await AsyncStorage.getItem(DOC_STORAGE_KEY);
    let doc: KinhaleDocument;
    if (stored !== null) {
      try {
        doc = loadDoc(Buffer.from(stored, 'base64'));
      } catch {
        doc = createDoc(householdId);
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
