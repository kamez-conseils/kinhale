import { describe, it, expect } from 'vitest';
import { secretboxKeygen } from '@kinhale/crypto';
import { encryptChanges, decryptChanges } from './encrypt.js';

describe('encryptChanges / decryptChanges', () => {
  it('encryptChanges retourne un EncryptedBlob avec nonce et ciphertext hex', async () => {
    const key = await secretboxKeygen();
    const changes = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
    const blob = await encryptChanges(changes, key);
    expect(typeof blob.nonce).toBe('string');
    expect(typeof blob.ciphertext).toBe('string');
    expect(blob.nonce).toHaveLength(48); // 24 bytes × 2 hex chars
    expect(blob.ciphertext.length).toBeGreaterThan(0);
  });

  it('decryptChanges restitue les Uint8Array originaux', async () => {
    const key = await secretboxKeygen();
    const original = [new Uint8Array([10, 20, 30]), new Uint8Array([40, 50])];
    const blob = await encryptChanges(original, key);
    const restored = await decryptChanges(blob, key);
    expect(restored).toHaveLength(2);
    expect(Array.from(restored[0]!)).toEqual([10, 20, 30]);
    expect(Array.from(restored[1]!)).toEqual([40, 50]);
  });

  it('deux encryptChanges du même plaintext → nonces différents', async () => {
    const key = await secretboxKeygen();
    const changes = [new Uint8Array([1, 2, 3])];
    const b1 = await encryptChanges(changes, key);
    const b2 = await encryptChanges(changes, key);
    expect(b1.nonce).not.toBe(b2.nonce);
    expect(b1.ciphertext).not.toBe(b2.ciphertext);
  });

  it('decryptChanges throw si la clé est incorrecte', async () => {
    const key1 = await secretboxKeygen();
    const key2 = await secretboxKeygen();
    const blob = await encryptChanges([new Uint8Array([1, 2, 3])], key1);
    await expect(decryptChanges(blob, key2)).rejects.toThrow();
  });

  it('decryptChanges fonctionne sur liste vide', async () => {
    const key = await secretboxKeygen();
    const blob = await encryptChanges([], key);
    const restored = await decryptChanges(blob, key);
    expect(restored).toHaveLength(0);
  });
});
