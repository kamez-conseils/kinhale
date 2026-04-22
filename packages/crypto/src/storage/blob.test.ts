import { describe, it, expect } from 'vitest';
import { encryptDocBlob, decryptDocBlob } from './blob.js';
import { generateStorageKey } from './key.js';

describe('encryptDocBlob / decryptDocBlob', () => {
  it("round-trip rend le plaintext d'origine", async () => {
    const key = await generateStorageKey();
    const plaintext = new TextEncoder().encode('hello automerge doc');
    const blob = await encryptDocBlob(plaintext, key);
    const decrypted = await decryptDocBlob(blob, key);
    expect(new TextDecoder().decode(decrypted)).toBe('hello automerge doc');
  });

  it('produit un blob avec nonceHex 48 chars + version 1', async () => {
    const key = await generateStorageKey();
    const blob = await encryptDocBlob(new Uint8Array([1, 2, 3]), key);
    expect(blob.nonceHex).toMatch(/^[0-9a-f]{48}$/);
    expect(blob.version).toBe(1);
    expect(blob.ciphertextHex.length).toBeGreaterThan(0);
  });

  it('deux chiffrements du même plaintext produisent des ciphertexts différents (nonce aléatoire)', async () => {
    const key = await generateStorageKey();
    const plaintext = new Uint8Array([1, 2, 3, 4]);
    const b1 = await encryptDocBlob(plaintext, key);
    const b2 = await encryptDocBlob(plaintext, key);
    expect(b1.ciphertextHex).not.toBe(b2.ciphertextHex);
    expect(b1.nonceHex).not.toBe(b2.nonceHex);
  });

  it('throw si la clé est fausse', async () => {
    const k1 = await generateStorageKey();
    const k2 = await generateStorageKey();
    const blob = await encryptDocBlob(new Uint8Array([1, 2, 3]), k1);
    await expect(decryptDocBlob(blob, k2)).rejects.toThrow();
  });

  it('throw si le ciphertext est altéré (MAC invalide)', async () => {
    const key = await generateStorageKey();
    const blob = await encryptDocBlob(new Uint8Array([1, 2, 3]), key);
    const tampered = {
      ...blob,
      ciphertextHex: blob.ciphertextHex.replace(/^./, (c) => (c === '0' ? '1' : '0')),
    };
    await expect(decryptDocBlob(tampered, key)).rejects.toThrow();
  });

  it("throw si la version n'est pas supportée", async () => {
    const key = await generateStorageKey();
    const blob = await encryptDocBlob(new Uint8Array([1]), key);
    // @ts-expect-error forcer une version invalide pour le test
    await expect(decryptDocBlob({ ...blob, version: 99 }, key)).rejects.toThrow();
  });
});
