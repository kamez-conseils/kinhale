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

describe('doc-store', () => {
  beforeEach(() => {
    useDocStore.setState({ doc: null });
    localStorage.clear();
    jest.clearAllMocks();
    mockCreateDoc.mockReturnValue(FAKE_DOC);
    mockSaveDoc.mockReturnValue(new Uint8Array([1, 2, 3]));
    mockGetDocChanges.mockReturnValue(FAKE_CHANGES);
    mockAppendEvent.mockReturnValue(FAKE_CHANGED_DOC);
    mockSignEvent.mockResolvedValue(FAKE_RECORD);
    mockMergeChanges.mockImplementation((doc: unknown) => doc);
  });

  describe('initDoc', () => {
    it('crée un nouveau doc quand localStorage vide', () => {
      useDocStore.getState().initDoc('hh-1');
      expect(mockCreateDoc).toHaveBeenCalledWith('hh-1');
      expect(useDocStore.getState().doc).toEqual(FAKE_DOC);
    });

    it('charge le doc existant depuis localStorage', () => {
      localStorage.setItem('kinhale-doc', Buffer.from([1, 2, 3]).toString('base64'));
      mockLoadDoc.mockReturnValue(FAKE_DOC);
      useDocStore.getState().initDoc('hh-1');
      expect(mockLoadDoc).toHaveBeenCalled();
      expect(useDocStore.getState().doc).toEqual(FAKE_DOC);
    });

    it('crée un nouveau doc si loadDoc lève une erreur', () => {
      localStorage.setItem('kinhale-doc', Buffer.from([1, 2, 3]).toString('base64'));
      mockLoadDoc.mockImplementation(() => {
        throw new Error('corrupt');
      });
      useDocStore.getState().initDoc('hh-1');
      expect(mockCreateDoc).toHaveBeenCalledWith('hh-1');
      expect(useDocStore.getState().doc).toEqual(FAKE_DOC);
    });
  });

  describe('appendDose', () => {
    it('signe, ajoute au doc, sauvegarde, retourne les changes', async () => {
      useDocStore.setState({ doc: FAKE_DOC as ReturnType<typeof mockCreateDoc> });
      const payload = {
        doseId: 'dose-1',
        pumpId: 'pump-1',
        childId: 'child-1',
        caregiverId: 'dev-1',
        administeredAtMs: 1000,
        doseType: 'maintenance',
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
    it('fusionne les changes et met à jour le doc', () => {
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
