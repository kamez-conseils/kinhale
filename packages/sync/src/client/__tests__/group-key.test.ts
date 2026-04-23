import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @kinhale/crypto — dérivation déterministe à partir du password uniquement.
// L'Argon2id réel serait trop lent et dépendrait de libsodium initialisé.
vi.mock('@kinhale/crypto', () => ({
  deriveKey: vi.fn(async (password: string, _salt: Uint8Array, outputLen: number) => {
    const result = new Uint8Array(outputLen);
    for (let i = 0; i < outputLen; i++) {
      result[i] = (password.charCodeAt(i % password.length) ?? 0) & 0xff;
    }
    return result;
  }),
}));

import { getGroupKey, _resetGroupKeyCache } from '../group-key.js';

describe('getGroupKey', () => {
  beforeEach(() => {
    _resetGroupKeyCache();
  });

  it('retourne une clé de 32 octets', async () => {
    const key = await getGroupKey('household-abc');
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key).toHaveLength(32);
  });

  it('retourne la même clé pour le même householdId (déterminisme)', async () => {
    const key1 = await getGroupKey('household-xyz');
    _resetGroupKeyCache();
    const key2 = await getGroupKey('household-xyz');
    expect(key1).toEqual(key2);
  });

  it('retourne des clés différentes pour des householdIds différents', async () => {
    const key1 = await getGroupKey('household-aaa');
    const key2 = await getGroupKey('household-bbb');
    expect(key1).not.toEqual(key2);
  });

  it('utilise le cache : deriveKey appelé une seule fois par householdId', async () => {
    const cryptoModule = await import('@kinhale/crypto');
    const deriveKey = vi.mocked(cryptoModule.deriveKey);
    deriveKey.mockClear();

    await getGroupKey('household-cached');
    await getGroupKey('household-cached');
    await getGroupKey('household-cached');

    expect(deriveKey).toHaveBeenCalledTimes(1);
  });
});
