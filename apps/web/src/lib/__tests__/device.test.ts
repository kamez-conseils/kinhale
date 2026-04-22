const mockGenerateSigningKeypair = jest.fn();
const mockSha256HexFromString = jest.fn();

jest.mock('@kinhale/crypto', () => ({
  generateSigningKeypair: (...args: unknown[]) => mockGenerateSigningKeypair(...args),
  sha256HexFromString: (...args: unknown[]) => mockSha256HexFromString(...args),
}));

import { getOrCreateDevice, getGroupKey } from '../device';

describe('device', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockGenerateSigningKeypair.mockResolvedValue({
      publicKey: new Uint8Array(32).fill(1),
      secretKey: new Uint8Array(64).fill(2),
    });
    mockSha256HexFromString.mockResolvedValue('a'.repeat(64));
  });

  describe('getOrCreateDevice', () => {
    it('génère un nouveau keypair si rien en localStorage', async () => {
      const result = await getOrCreateDevice();
      expect(mockGenerateSigningKeypair).toHaveBeenCalledTimes(1);
      expect(result.publicKeyHex).toHaveLength(64);
      expect(result.publicKey).toBeInstanceOf(Uint8Array);
      expect(result.secretKey).toBeInstanceOf(Uint8Array);
    });

    it('persiste le keypair dans localStorage', async () => {
      await getOrCreateDevice();
      const stored = localStorage.getItem('kinhale-device-key');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!) as { publicKeyHex: string; secretKeyBase64: string };
      expect(parsed.publicKeyHex).toHaveLength(64);
      expect(parsed.secretKeyBase64).toBeTruthy();
    });

    it('réutilise le keypair existant sans regénérer', async () => {
      await getOrCreateDevice();
      const first = await getOrCreateDevice();
      const second = await getOrCreateDevice();
      expect(mockGenerateSigningKeypair).toHaveBeenCalledTimes(1);
      expect(first.publicKeyHex).toBe(second.publicKeyHex);
    });

    it('régénère si localStorage corrompu', async () => {
      localStorage.setItem('kinhale-device-key', 'not-valid-json');
      const result = await getOrCreateDevice();
      expect(mockGenerateSigningKeypair).toHaveBeenCalledTimes(1);
      expect(result.publicKeyHex).toHaveLength(64);
    });

    it('régénère si localStorage contient un objet invalide', async () => {
      localStorage.setItem('kinhale-device-key', JSON.stringify({ bad: true }));
      const result = await getOrCreateDevice();
      expect(mockGenerateSigningKeypair).toHaveBeenCalledTimes(1);
      expect(result.publicKeyHex).toHaveLength(64);
    });
  });

  describe('getGroupKey', () => {
    it('appelle sha256HexFromString avec householdId + suffix', async () => {
      await getGroupKey('hh-123');
      expect(mockSha256HexFromString).toHaveBeenCalledWith('hh-123:kinhale-dev-v1');
    });

    it('retourne un Uint8Array de 32 bytes', async () => {
      const key = await getGroupKey('hh-123');
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
    });

    it('est déterministe pour le même householdId', async () => {
      const k1 = await getGroupKey('hh-abc');
      const k2 = await getGroupKey('hh-abc');
      expect(Array.from(k1)).toEqual(Array.from(k2));
    });
  });
});
