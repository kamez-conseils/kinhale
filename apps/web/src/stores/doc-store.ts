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
import type { KinhaleDoc, DoseAdministeredPayload, UnsignedEvent } from '@kinhale/sync';

type KinhaleDocument = ReturnType<typeof createDoc>;

const DOC_STORAGE_KEY = 'kinhale-doc';

interface DocState {
  doc: KinhaleDocument | null;
  initDoc: (householdId: string) => void;
  appendDose: (
    payload: DoseAdministeredPayload,
    deviceId: string,
    secretKey: Uint8Array,
  ) => Promise<Uint8Array[]>;
  receiveChanges: (changes: Uint8Array[]) => void;
}

function persistDoc(doc: KinhaleDocument): void {
  const binary = saveDoc(doc);
  localStorage.setItem(DOC_STORAGE_KEY, Buffer.from(binary).toString('base64'));
}

export const useDocStore = create<DocState>()((set, get) => ({
  doc: null,

  initDoc(householdId) {
    const stored = localStorage.getItem(DOC_STORAGE_KEY);
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
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
      deviceId,
      occurredAtMs: Date.now(),
      event: { type: 'DoseAdministered', payload },
    };
    const record = await signEvent(unsigned, secretKey);
    const newDoc = appendEvent(doc, record);
    const changes = getDocChanges(doc, newDoc);

    persistDoc(newDoc);
    set({ doc: newDoc });
    return changes;
  },

  receiveChanges(changes) {
    const doc = get().doc;
    if (doc === null) return;
    const newDoc = mergeChanges(doc, changes);
    persistDoc(newDoc);
    set({ doc: newDoc });
  },
}));
