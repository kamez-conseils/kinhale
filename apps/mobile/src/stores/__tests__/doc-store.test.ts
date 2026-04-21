import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@kinhale/sync');
jest.mock('@kinhale/crypto');

describe('useDocStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('starts with null doc', () => {
    const { useDocStore } = require('../doc-store') as typeof import('../doc-store');
    expect(useDocStore.getState().doc).toBeNull();
  });

  it('initDoc creates a new doc when nothing stored', async () => {
    const { useDocStore } = require('../doc-store') as typeof import('../doc-store');
    await useDocStore.getState().initDoc('hh-1');
    expect(useDocStore.getState().doc).not.toBeNull();
  });

  it('appendDose returns changes array', async () => {
    const { useDocStore } = require('../doc-store') as typeof import('../doc-store');
    await useDocStore.getState().initDoc('hh-1');
    const changes = await useDocStore.getState().appendDose(
      {
        doseId: 'dose-1',
        pumpId: 'pump-1',
        childId: 'child-1',
        caregiverId: 'dev-1',
        administeredAtMs: Date.now(),
        doseType: 'maintenance',
        dosesAdministered: 1,
        symptoms: [],
        circumstances: [],
        freeFormTag: null,
      },
      'dev-1',
      new Uint8Array(64),
    );
    expect(Array.isArray(changes)).toBe(true);
  });
});
