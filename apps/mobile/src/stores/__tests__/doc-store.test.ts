/**
 * IMPORTANT: Because we use jest.resetModules() in beforeEach to get a fresh
 * doc-store (with module-level `sek` reset to null), every require() in test
 * bodies must happen AFTER beforeEach. Static top-level imports share the
 * pre-reset module registry; use require() inside each test body instead to
 * ensure all modules (including AsyncStorage) come from the same fresh registry.
 */

jest.mock('@kinhale/sync');
jest.mock('@kinhale/crypto');
// expo-secure-store is mapped via jest.config.js moduleNameMapper

/**
 * Flush pending microtasks so fire-and-forget `void persistDoc(...)` settles.
 */
async function flushAsync(rounds = 8): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

/**
 * Get the AsyncStorage module that the currently-loaded doc-store uses.
 * Must be called AFTER require('../doc-store') in the same test body.
 */
function getAsyncStorage() {
  // The async-storage jest mock uses `module.exports = asMock` (no .default).
  // We handle both CJS (module.exports = asMock) and ESM (.default) shapes.
  type ASDefault = typeof import('@react-native-async-storage/async-storage').default;
  type ASMod = { default?: ASDefault } | ASDefault;
  const mod = require('@react-native-async-storage/async-storage') as ASMod;
  return ('default' in mod && mod.default !== undefined ? mod.default : mod) as ASDefault;
}

describe('useDocStore', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();
    // Ensure AsyncStorage is cleared after reset (fresh module = fresh store anyway).
    const AS = getAsyncStorage();
    await AS.clear();
    // Reset the in-memory SecureStore mock.
    const ss = require('expo-secure-store') as { __resetForTests?: () => void };
    (ss.__resetForTests ?? (() => {}))();
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

  // ── NEW TESTS ──────────────────────────────────────────────────────────────

  it('initDoc creates a SEK on first launch and reuses it on second call', async () => {
    const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
    const { generateStorageKey } = require('@kinhale/crypto') as typeof import('@kinhale/crypto');
    const { useDocStore } = require('../doc-store') as typeof import('../doc-store');

    // First launch — no SEK in keychain yet.
    await useDocStore.getState().initDoc('hh-1');
    expect(generateStorageKey).toHaveBeenCalledTimes(1);

    // SEK must be persisted in SecureStore under the kinhale-sek slot.
    const stored = await SecureStore.getItemAsync('kinhale-sek');
    expect(stored).not.toBeNull();

    // Second call (same module instance) — key is already in SecureStore.
    jest.clearAllMocks();
    await useDocStore.getState().initDoc('hh-1');
    // generateStorageKey must NOT be called again (key already stored).
    expect(generateStorageKey).not.toHaveBeenCalled();
  });

  it('persistDoc writes a JSON blob with version:1 (not raw base64) to AsyncStorage', async () => {
    const { useDocStore } = require('../doc-store') as typeof import('../doc-store');
    const AS = getAsyncStorage();

    await useDocStore.getState().initDoc('hh-1');

    // appendDose triggers persistDoc internally (fire-and-forget).
    await useDocStore.getState().appendDose(
      {
        doseId: 'dose-2',
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

    // Flush microtasks so the fire-and-forget persistDoc settles.
    await flushAsync();

    const raw = await AS.getItem('kinhale-doc');
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!) as unknown;
    expect(typeof parsed).toBe('object');
    expect((parsed as { version: unknown }).version).toBe(1);
    expect(typeof (parsed as { nonceHex: unknown }).nonceHex).toBe('string');
    expect(typeof (parsed as { ciphertextHex: unknown }).ciphertextHex).toBe('string');
  });

  it('round-trip: initDoc → appendDose → reset → initDoc reads back the doc', async () => {
    // Session 1: write an encrypted doc.
    const { useDocStore } = require('../doc-store') as typeof import('../doc-store');
    const AS1 = getAsyncStorage();
    const SecureStore1 = require('expo-secure-store') as typeof import('expo-secure-store');

    await useDocStore.getState().initDoc('hh-round');

    await useDocStore.getState().appendDose(
      {
        doseId: 'dose-rt',
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

    // Flush fire-and-forget persist.
    await flushAsync();

    // Capture the encrypted blob and the SEK from session 1.
    const encryptedBlob = await AS1.getItem('kinhale-doc');
    const storedSek = await SecureStore1.getItemAsync('kinhale-sek');
    expect(encryptedBlob).not.toBeNull();
    expect(storedSek).not.toBeNull();
    const parsedBlob = JSON.parse(encryptedBlob!) as { version: unknown };
    expect(parsedBlob.version).toBe(1);

    // Session 2: simulate app restart. Reset module registry so module-level
    // `sek` is null again. Transfer the persisted data to the new instances.
    jest.resetModules();

    // Restore data into the fresh module instances.
    const AS2 = getAsyncStorage();
    const SecureStore2 = require('expo-secure-store') as typeof import('expo-secure-store');
    await AS2.setItem('kinhale-doc', encryptedBlob!);
    await SecureStore2.setItemAsync('kinhale-sek', storedSek!);

    const { decryptDocBlob } = require('@kinhale/crypto') as typeof import('@kinhale/crypto');
    const { loadDoc } = require('@kinhale/sync') as typeof import('@kinhale/sync');
    const { useDocStore: store2 } = require('../doc-store') as typeof import('../doc-store');

    await store2.getState().initDoc('hh-round');

    // decryptDocBlob must have been called to decrypt the stored blob.
    expect(decryptDocBlob).toHaveBeenCalled();
    // loadDoc must have been called with the decrypted bytes.
    expect(loadDoc).toHaveBeenCalled();
    expect(store2.getState().doc).not.toBeNull();
  });

  it('migration: old base64 format is read and immediately re-saved as encrypted v1', async () => {
    const { Buffer: Buf } = require('buffer') as typeof import('buffer');

    // Require in the order that shares the same registry entries with doc-store.
    const { loadDoc } = require('@kinhale/sync') as typeof import('@kinhale/sync');
    const { encryptDocBlob } = require('@kinhale/crypto') as typeof import('@kinhale/crypto');
    const { useDocStore } = require('../doc-store') as typeof import('../doc-store');
    const AS = getAsyncStorage();

    // Plant a v0 (raw base64) entry — mimics the old unencrypted format.
    const fakeBinary = new Uint8Array([1, 2, 3, 4, 5]);
    await AS.setItem('kinhale-doc', Buf.from(fakeBinary).toString('base64'));

    await useDocStore.getState().initDoc('hh-mig');

    // loadDoc must have been called with the old binary content.
    expect(loadDoc).toHaveBeenCalled();

    // initDoc must have immediately re-saved in encrypted form.
    expect(encryptDocBlob).toHaveBeenCalled();

    // The value now in AsyncStorage must be a JSON v1 blob (not raw base64).
    const raw = await AS.getItem('kinhale-doc');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as unknown;
    expect((parsed as { version: unknown }).version).toBe(1);

    expect(useDocStore.getState().doc).not.toBeNull();
  });
});
