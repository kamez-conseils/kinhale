// Mock miroir de packages/crypto/src/index.ts
import { Buffer } from 'buffer';

export const sha256Hex = jest.fn().mockResolvedValue('a'.repeat(64));
export const sha256HexFromString = jest.fn().mockResolvedValue('a'.repeat(64));
export const CRYPTO_UNAVAILABLE_MESSAGE = 'crypto unavailable';

// KIN-040 : BLAKE2b keyed pour pseudonymisation télémétrie.
export const BLAKE2B_DEFAULT_BYTES = 8;
export const blake2bHex = jest.fn().mockResolvedValue('b'.repeat(16));

export const getSodium = jest.fn().mockResolvedValue({});

export const generateSigningKeypair = jest.fn().mockReturnValue({
  publicKey: new Uint8Array(32),
  secretKey: new Uint8Array(64),
});
export const sign = jest.fn().mockReturnValue(new Uint8Array(64));
export const verify = jest.fn().mockReturnValue(true);

export const secretboxKeygen = jest.fn().mockReturnValue(new Uint8Array(32));
export const secretboxNonce = jest.fn().mockReturnValue(new Uint8Array(24));
export const secretbox = jest.fn().mockReturnValue(new Uint8Array(10));
export const secretboxOpen = jest.fn().mockReturnValue(new Uint8Array(10));

export const deriveKey = jest.fn().mockResolvedValue(new Uint8Array(32));
export const generateSalt = jest.fn().mockReturnValue(new Uint8Array(16));
export const ARGON2ID_PARAMS = { opsLimit: 3, memLimit: 65536 };

export const randomBytes = jest.fn().mockReturnValue(new Uint8Array(32));

export const toHex = jest.fn().mockReturnValue('a'.repeat(64));
export const fromHex = jest.fn().mockReturnValue(new Uint8Array(32));
export const toBase64url = jest.fn().mockReturnValue('base64url==');
export const fromBase64url = jest.fn().mockReturnValue(new Uint8Array(32));

export const generateKeyExchangeKeypair = jest.fn().mockReturnValue({
  publicKey: new Uint8Array(32),
  secretKey: new Uint8Array(32),
});
export const clientSessionKeys = jest.fn().mockReturnValue({
  sharedRx: new Uint8Array(32),
  sharedTx: new Uint8Array(32),
});
export const serverSessionKeys = jest.fn().mockReturnValue({
  sharedRx: new Uint8Array(32),
  sharedTx: new Uint8Array(32),
});
export const ed25519ToX25519 = jest.fn().mockReturnValue(new Uint8Array(32));

export const generateSeedPhrase = jest
  .fn()
  .mockReturnValue('word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12');
export const validateSeedPhrase = jest.fn().mockReturnValue(true);
export const seedPhraseToBytes = jest.fn().mockReturnValue(new Uint8Array(32));

export const deriveDeviceKeypair = jest.fn().mockReturnValue({
  publicKey: new Uint8Array(32),
  secretKey: new Uint8Array(64),
  publicKeyHex: 'a'.repeat(64),
});

export const generateStorageKey = jest.fn().mockResolvedValue(new Uint8Array(32).fill(42));
export const encryptDocBlob = jest.fn(async (plaintext: Uint8Array) => ({
  nonceHex: '00'.repeat(24),
  ciphertextHex: Buffer.from(plaintext).toString('hex'),
  version: 1 as const,
}));
export const decryptDocBlob = jest.fn(async (blob: { ciphertextHex: string }) =>
  Uint8Array.from(Buffer.from(blob.ciphertextHex, 'hex')),
);
