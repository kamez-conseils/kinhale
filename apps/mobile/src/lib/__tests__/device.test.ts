import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@kinhale/crypto');

describe('getOrCreateDevice', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('creates and persists a new device keypair', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getOrCreateDevice } = require('../device') as typeof import('../device');
    const kp = await getOrCreateDevice();
    expect(kp).toHaveProperty('publicKeyHex');
    expect(kp).toHaveProperty('secretKey');
    const stored = await AsyncStorage.getItem('kinhale-device');
    expect(stored).not.toBeNull();
  });

  it('returns the same keypair on second call', async () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getOrCreateDevice } = require('../device') as typeof import('../device');
    const kp1 = await getOrCreateDevice();
    const kp2 = await getOrCreateDevice();
    expect(kp1.publicKeyHex).toBe(kp2.publicKeyHex);
  });

  it('returns same keypair after AsyncStorage reload', async () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getOrCreateDevice: get1 } = require('../device') as typeof import('../device');
    const kp1 = await get1();
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getOrCreateDevice: get2 } = require('../device') as typeof import('../device');
    const kp2 = await get2();
    expect(kp1.publicKeyHex).toBe(kp2.publicKeyHex);
  });
});

describe('getGroupKey', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('derives a Uint8Array key for a household', async () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getGroupKey } = require('../device') as typeof import('../device');
    const key = await getGroupKey('hh-abc');
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBeGreaterThan(0);
  });

  it('returns the same key for the same householdId', async () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getGroupKey } = require('../device') as typeof import('../device');
    const k1 = await getGroupKey('hh-abc');
    const k2 = await getGroupKey('hh-abc');
    expect(k1).toEqual(k2);
  });
});
