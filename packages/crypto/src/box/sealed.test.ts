import { describe, it, expect } from 'vitest';
import {
  sealedBoxEncrypt,
  sealedBoxDecrypt,
  SEALED_BOX_OVERHEAD_BYTES,
  SEALED_BOX_PUBLIC_KEY_BYTES,
} from './sealed.js';
import { generateKeyExchangeKeypair } from '../kx/x25519.js';

describe('sealed box (X25519 anonymous encryption)', () => {
  it('round-trip : chiffre puis déchiffre avec la keypair correspondante', async () => {
    const recipient = await generateKeyExchangeKeypair();
    const plaintext = new TextEncoder().encode('groupKey opaque');
    const ciphertext = await sealedBoxEncrypt(plaintext, recipient.publicKey);
    const decrypted = await sealedBoxDecrypt(ciphertext, recipient);
    expect(decrypted).not.toBeNull();
    expect(new TextDecoder().decode(decrypted as Uint8Array)).toBe('groupKey opaque');
  });

  it('le ciphertext ajoute exactement 48 octets de surcoût (32 ephemeral + 16 MAC)', async () => {
    const recipient = await generateKeyExchangeKeypair();
    const plaintext = new Uint8Array(32); // groupKey 32B
    const ciphertext = await sealedBoxEncrypt(plaintext, recipient.publicKey);
    expect(ciphertext.length).toBe(plaintext.length + SEALED_BOX_OVERHEAD_BYTES);
  });

  it('retourne null si déchiffrement avec une autre keypair (mauvaise clé)', async () => {
    const recipient = await generateKeyExchangeKeypair();
    const attacker = await generateKeyExchangeKeypair();
    const plaintext = new TextEncoder().encode('secret');
    const ciphertext = await sealedBoxEncrypt(plaintext, recipient.publicKey);
    const result = await sealedBoxDecrypt(ciphertext, attacker);
    expect(result).toBeNull();
  });

  it('retourne null si le ciphertext est altéré (1 bit flippé sur le payload)', async () => {
    const recipient = await generateKeyExchangeKeypair();
    const plaintext = new TextEncoder().encode('groupKey');
    const ciphertext = await sealedBoxEncrypt(plaintext, recipient.publicKey);
    // Flip un bit dans la portion chiffrée (après l'ephemeral pk de 32 octets)
    ciphertext[40] ^= 0x01;
    const result = await sealedBoxDecrypt(ciphertext, recipient);
    expect(result).toBeNull();
  });

  it('retourne null si le ciphertext est altéré sur la clé éphémère', async () => {
    const recipient = await generateKeyExchangeKeypair();
    const plaintext = new TextEncoder().encode('groupKey');
    const ciphertext = await sealedBoxEncrypt(plaintext, recipient.publicKey);
    // Flip un bit dans l'ephemeral public key (premiers 32 octets)
    ciphertext[5] ^= 0x80;
    const result = await sealedBoxDecrypt(ciphertext, recipient);
    expect(result).toBeNull();
  });

  it('retourne null si le ciphertext est plus court que SEALED_BOX_OVERHEAD_BYTES', async () => {
    const recipient = await generateKeyExchangeKeypair();
    const tooShort = new Uint8Array(SEALED_BOX_OVERHEAD_BYTES - 1);
    const result = await sealedBoxDecrypt(tooShort, recipient);
    expect(result).toBeNull();
  });

  it('lève une erreur si la clé publique destinataire ne fait pas 32 octets', async () => {
    const tooShort = new Uint8Array(SEALED_BOX_PUBLIC_KEY_BYTES - 1);
    const plaintext = new TextEncoder().encode('x');
    await expect(sealedBoxEncrypt(plaintext, tooShort)).rejects.toThrow(
      /recipientPublicKey doit faire 32 octets/u,
    );
  });

  it('deux chiffrements du même plaintext produisent deux ciphertexts différents (ephemeral keypair)', async () => {
    const recipient = await generateKeyExchangeKeypair();
    const plaintext = new TextEncoder().encode('groupKey identique');
    const c1 = await sealedBoxEncrypt(plaintext, recipient.publicKey);
    const c2 = await sealedBoxEncrypt(plaintext, recipient.publicKey);
    // Très haute probabilité que la clé éphémère diffère → ciphertexts distincts.
    expect(Buffer.from(c1).toString('hex')).not.toBe(Buffer.from(c2).toString('hex'));
    // Mais les deux doivent se déchiffrer correctement
    const d1 = await sealedBoxDecrypt(c1, recipient);
    const d2 = await sealedBoxDecrypt(c2, recipient);
    expect(d1).not.toBeNull();
    expect(d2).not.toBeNull();
    expect(new TextDecoder().decode(d1 as Uint8Array)).toBe('groupKey identique');
    expect(new TextDecoder().decode(d2 as Uint8Array)).toBe('groupKey identique');
  });

  it("chiffre une groupKey 32B (cas d'usage Kinhale) sans dégrader la clé", async () => {
    const recipient = await generateKeyExchangeKeypair();
    // Simule une groupKey aléatoire 32B
    const groupKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) groupKey[i] = (i * 17) % 256;

    const sealed = await sealedBoxEncrypt(groupKey, recipient.publicKey);
    expect(sealed.length).toBe(32 + SEALED_BOX_OVERHEAD_BYTES); // 80 octets
    const opened = await sealedBoxDecrypt(sealed, recipient);
    expect(opened).not.toBeNull();
    expect(opened).toEqual(groupKey);
  });

  it('refuse une keypair destinataire avec privateKey de longueur invalide', async () => {
    const recipient = await generateKeyExchangeKeypair();
    const plaintext = new TextEncoder().encode('groupKey');
    const ciphertext = await sealedBoxEncrypt(plaintext, recipient.publicKey);

    const malformed = {
      publicKey: recipient.publicKey,
      privateKey: new Uint8Array(31), // taille invalide
    };
    expect(await sealedBoxDecrypt(ciphertext, malformed)).toBeNull();
  });

  it('refuse une keypair destinataire avec publicKey de longueur invalide', async () => {
    const recipient = await generateKeyExchangeKeypair();
    const plaintext = new TextEncoder().encode('groupKey');
    const ciphertext = await sealedBoxEncrypt(plaintext, recipient.publicKey);

    const malformed = {
      publicKey: new Uint8Array(31),
      privateKey: recipient.privateKey,
    };
    expect(await sealedBoxDecrypt(ciphertext, malformed)).toBeNull();
  });
});
