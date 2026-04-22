/**
 * Tests doc-store — IndexedDB + chiffrement au repos.
 * fake-indexeddb/auto est chargé globalement via jest.setup.ts.
 */

const mockCreateDoc = jest.fn();
const mockLoadDoc = jest.fn();
const mockSaveDoc = jest.fn();
const mockGetDocChanges = jest.fn();
const mockMergeChanges = jest.fn();
const mockAppendEvent = jest.fn();
const mockSignEvent = jest.fn();

jest.mock('@kinhale/sync', () => ({
  createDoc: (...a: unknown[]) => mockCreateDoc(...a),
  loadDoc: (...a: unknown[]) => mockLoadDoc(...a),
  saveDoc: (...a: unknown[]) => mockSaveDoc(...a),
  getDocChanges: (...a: unknown[]) => mockGetDocChanges(...a),
  mergeChanges: (...a: unknown[]) => mockMergeChanges(...a),
  appendEvent: (...a: unknown[]) => mockAppendEvent(...a),
  signEvent: (...a: unknown[]) => mockSignEvent(...a),
}));

// Mocks crypto légers pour éviter le coût Argon2id en CI
const mockGenerateStorageKey = jest.fn().mockResolvedValue(new Uint8Array(32).fill(42));
const mockEncryptDocBlob = jest.fn(async (plaintext: Uint8Array, _key: Uint8Array) => ({
  nonceHex: '00'.repeat(24),
  ciphertextHex: Buffer.from(plaintext).toString('hex'),
  version: 1 as const,
}));
const mockDecryptDocBlob = jest.fn(async (blob: { ciphertextHex: string }, _key: Uint8Array) =>
  Uint8Array.from(Buffer.from(blob.ciphertextHex, 'hex')),
);

jest.mock('@kinhale/crypto', () => ({
  generateStorageKey: (...a: unknown[]) => mockGenerateStorageKey(...a),
  encryptDocBlob: (...a: unknown[]) => mockEncryptDocBlob(...(a as [Uint8Array, Uint8Array])),
  decryptDocBlob: (...a: unknown[]) =>
    mockDecryptDocBlob(...(a as [{ ciphertextHex: string }, Uint8Array])),
}));

import { openDB } from 'idb';
import { useDocStore } from '../doc-store';

const FAKE_DOC = { householdId: 'hh-1', events: [] };
const FAKE_CHANGED_DOC = { householdId: 'hh-1', events: [{ id: 'e1' }] };
const FAKE_CHANGES = [new Uint8Array([10, 20])];
const FAKE_RECORD = {
  id: 'e1',
  type: 'DoseAdministered',
  payloadJson: '{}',
  signerPublicKeyHex: 'aa'.repeat(32),
  signatureHex: 'bb'.repeat(32),
  deviceId: 'dev-1',
  occurredAtMs: 1000,
};

/** Vide les deux object stores IndexedDB entre chaque test. */
async function clearIDB(): Promise<void> {
  const db = await openDB('kinhale', 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('keys')) d.createObjectStore('keys');
      if (!d.objectStoreNames.contains('doc')) d.createObjectStore('doc');
    },
  });
  await db.clear('keys');
  await db.clear('doc');
  db.close();
}

describe('doc-store', () => {
  beforeEach(async () => {
    useDocStore.setState({ doc: null });
    localStorage.clear();
    jest.clearAllMocks();
    mockCreateDoc.mockReturnValue(FAKE_DOC);
    mockSaveDoc.mockReturnValue(new Uint8Array([1, 2, 3]));
    mockGetDocChanges.mockReturnValue(FAKE_CHANGES);
    mockAppendEvent.mockReturnValue(FAKE_CHANGED_DOC);
    mockSignEvent.mockResolvedValue(FAKE_RECORD);
    mockMergeChanges.mockImplementation((doc: unknown) => doc);
    mockGenerateStorageKey.mockResolvedValue(new Uint8Array(32).fill(42));
    mockEncryptDocBlob.mockImplementation(async (plaintext: Uint8Array) => ({
      nonceHex: '00'.repeat(24),
      ciphertextHex: Buffer.from(plaintext).toString('hex'),
      version: 1 as const,
    }));
    mockDecryptDocBlob.mockImplementation(async (blob: { ciphertextHex: string }) =>
      Uint8Array.from(Buffer.from(blob.ciphertextHex, 'hex')),
    );
    await clearIDB();
  });

  describe('initDoc', () => {
    it('crée un nouveau doc quand IDB et localStorage sont vides', async () => {
      await useDocStore.getState().initDoc('hh-1');
      expect(mockCreateDoc).toHaveBeenCalledWith('hh-1');
      expect(useDocStore.getState().doc).toEqual(FAKE_DOC);
    });

    it('charge un doc existant depuis IDB (format chiffré)', async () => {
      // Pré-insérer un blob chiffré simulé dans IDB
      const fakeBlob = {
        nonceHex: '00'.repeat(24),
        ciphertextHex: Buffer.from(new Uint8Array([1, 2, 3])).toString('hex'),
        version: 1 as const,
      };
      const db = await openDB('kinhale', 1);
      await db.put('doc', fakeBlob, 'current');
      db.close();

      mockLoadDoc.mockReturnValue(FAKE_DOC);
      await useDocStore.getState().initDoc('hh-1');

      expect(mockDecryptDocBlob).toHaveBeenCalledWith(fakeBlob, expect.any(Uint8Array));
      expect(mockLoadDoc).toHaveBeenCalled();
      expect(useDocStore.getState().doc).toEqual(FAKE_DOC);
    });

    it('crée un nouveau doc si decryptDocBlob lève une erreur', async () => {
      const fakeBlob = {
        nonceHex: '00'.repeat(24),
        ciphertextHex: 'deadbeef',
        version: 1 as const,
      };
      const db = await openDB('kinhale', 1);
      await db.put('doc', fakeBlob, 'current');
      db.close();

      mockDecryptDocBlob.mockRejectedValueOnce(new Error('MAC mismatch'));
      await useDocStore.getState().initDoc('hh-1');

      expect(mockCreateDoc).toHaveBeenCalledWith('hh-1');
      expect(useDocStore.getState().doc).toEqual(FAKE_DOC);
    });
  });

  describe('migration localStorage → IDB', () => {
    it('migrate le doc base64 de localStorage vers IDB et supprime la clé', async () => {
      const binary = new Uint8Array([10, 20, 30]);
      localStorage.setItem('kinhale-doc', Buffer.from(binary).toString('base64'));
      mockLoadDoc.mockReturnValue(FAKE_DOC);

      await useDocStore.getState().initDoc('hh-1');

      // La clé localStorage doit être supprimée
      expect(localStorage.getItem('kinhale-doc')).toBeNull();

      // Le doc est bien chargé
      expect(useDocStore.getState().doc).toEqual(FAKE_DOC);

      // IDB doit contenir un blob chiffré
      const db = await openDB('kinhale', 1);
      const stored = await db.get('doc', 'current');
      db.close();
      expect(stored).not.toBeNull();
      expect((stored as { version: number }).version).toBe(1);
    });

    it('crée un nouveau doc si le doc localStorage est corrompu', async () => {
      localStorage.setItem('kinhale-doc', 'not-valid-base64!!!');
      mockLoadDoc.mockImplementation(() => {
        throw new Error('corrupt');
      });

      await useDocStore.getState().initDoc('hh-1');

      expect(mockCreateDoc).toHaveBeenCalledWith('hh-1');
      expect(useDocStore.getState().doc).toEqual(FAKE_DOC);
    });
  });

  describe('SEK (Storage Encryption Key)', () => {
    it('crée et persiste la SEK dans IDB au premier lancement', async () => {
      await useDocStore.getState().initDoc('hh-1');

      expect(mockGenerateStorageKey).toHaveBeenCalledTimes(1);

      // La clé doit être présente dans IDB
      const db = await openDB('kinhale', 1);
      const sek = await db.get('keys', 'sek');
      db.close();
      // ArrayBuffer.isView couvre Uint8Array cross-realm (contextes JSDOM/fake-indexeddb)
      expect(ArrayBuffer.isView(sek)).toBe(true);
    });

    it('réutilise la SEK existante sans en générer une nouvelle', async () => {
      // Premier appel — crée la SEK
      await useDocStore.getState().initDoc('hh-1');
      expect(mockGenerateStorageKey).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();

      // Réinitialise l'état Zustand mais conserve IDB
      useDocStore.setState({ doc: null });

      mockCreateDoc.mockReturnValue(FAKE_DOC);
      mockSaveDoc.mockReturnValue(new Uint8Array([1, 2, 3]));

      // Deuxième appel — doit réutiliser la SEK de IDB
      await useDocStore.getState().initDoc('hh-1');
      expect(mockGenerateStorageKey).not.toHaveBeenCalled();
    });
  });

  describe('persistDoc', () => {
    it('écrit un blob chiffré dans IDB et non dans localStorage', async () => {
      await useDocStore.getState().initDoc('hh-1');

      // localStorage ne doit PAS contenir kinhale-doc
      expect(localStorage.getItem('kinhale-doc')).toBeNull();

      // IDB doit avoir le blob chiffré
      const db = await openDB('kinhale', 1);
      const stored = await db.get('doc', 'current');
      db.close();
      expect(stored).not.toBeNull();
      expect((stored as { version: number }).version).toBe(1);
    });
  });

  describe('round-trip : persistDoc → reload', () => {
    it("recharge le doc chiffré après réinitialisation de l'état", async () => {
      // initDoc initiale — crée un doc
      await useDocStore.getState().initDoc('hh-1');

      // Simule appendDose pour forcer une persistance avec doc différent
      useDocStore.setState({ doc: FAKE_CHANGED_DOC as ReturnType<typeof mockCreateDoc> });
      mockSaveDoc.mockReturnValue(new Uint8Array([99, 88, 77]));

      // Persiste manuellement via appendDose
      const payload = {
        doseId: 'dose-1',
        pumpId: 'pump-1',
        childId: 'child-1',
        caregiverId: 'dev-1',
        administeredAtMs: 1000,
        doseType: 'maintenance' as const,
        dosesAdministered: 1,
        symptoms: [],
        circumstances: [],
        freeFormTag: null,
      };
      await useDocStore.getState().appendDose(payload, 'dev-1', new Uint8Array(64));

      // Réinitialise l'état Zustand (simule un rechargement du module)
      useDocStore.setState({ doc: null });
      mockLoadDoc.mockReturnValue(FAKE_CHANGED_DOC);

      // Recharge depuis IDB
      await useDocStore.getState().initDoc('hh-1');

      expect(mockDecryptDocBlob).toHaveBeenCalled();
      expect(mockLoadDoc).toHaveBeenCalled();
      expect(useDocStore.getState().doc).toEqual(FAKE_CHANGED_DOC);
    });
  });

  describe('appendDose', () => {
    it('signe, ajoute au doc, sauvegarde dans IDB, retourne les changes', async () => {
      await useDocStore.getState().initDoc('hh-1');
      useDocStore.setState({ doc: FAKE_DOC as ReturnType<typeof mockCreateDoc> });

      const payload = {
        doseId: 'dose-1',
        pumpId: 'pump-1',
        childId: 'child-1',
        caregiverId: 'dev-1',
        administeredAtMs: 1000,
        doseType: 'maintenance' as const,
        dosesAdministered: 1,
        symptoms: [],
        circumstances: [],
        freeFormTag: null,
      };
      const changes = await useDocStore.getState().appendDose(payload, 'dev-1', new Uint8Array(64));
      expect(mockSignEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'dev-1',
          event: expect.objectContaining({ type: 'DoseAdministered' }),
        }),
        expect.any(Uint8Array),
      );
      expect(mockAppendEvent).toHaveBeenCalledWith(FAKE_DOC, FAKE_RECORD);
      expect(mockSaveDoc).toHaveBeenCalled();
      expect(changes).toEqual(FAKE_CHANGES);
      expect(useDocStore.getState().doc).toEqual(FAKE_CHANGED_DOC);
    });
  });

  describe('receiveChanges', () => {
    it('fusionne les changes et met à jour le doc', async () => {
      await useDocStore.getState().initDoc('hh-1');
      const mergedDoc = { householdId: 'hh-1', events: [{ id: 'remote-1' }] };
      mockMergeChanges.mockReturnValue(mergedDoc);
      useDocStore.setState({ doc: FAKE_DOC as ReturnType<typeof mockCreateDoc> });
      useDocStore.getState().receiveChanges(FAKE_CHANGES);
      expect(mockMergeChanges).toHaveBeenCalledWith(FAKE_DOC, FAKE_CHANGES);
      expect(useDocStore.getState().doc).toEqual(mergedDoc);
    });

    it('ignore si doc null', () => {
      useDocStore.getState().receiveChanges(FAKE_CHANGES);
      expect(mockMergeChanges).not.toHaveBeenCalled();
    });
  });
});
