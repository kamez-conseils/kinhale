import { describe, it, expect } from 'vitest';
import { deriveDeviceKeypair } from './keypair.js';
import { generateSeedPhrase } from '../seed/bip39.js';
import { sign } from '../sign/ed25519.js';
import { clientSessionKeys, serverSessionKeys, generateKeyExchangeKeypair } from '../kx/x25519.js';

describe('deriveDeviceKeypair', () => {
  it('retourne signing (Ed25519) et exchange (X25519) keypairs', async () => {
    const phrase = generateSeedPhrase();
    const kp = await deriveDeviceKeypair(phrase);
    expect(kp.signing.publicKey).toHaveLength(32);
    expect(kp.signing.secretKey).toHaveLength(64);
    expect(kp.exchange.publicKey).toHaveLength(32);
    expect(kp.exchange.privateKey).toHaveLength(32);
  }, 15_000);

  it('déterministe : même seed → même keypair', async () => {
    const phrase = generateSeedPhrase();
    const kp1 = await deriveDeviceKeypair(phrase);
    const kp2 = await deriveDeviceKeypair(phrase);
    expect(Buffer.from(kp1.signing.publicKey).toString('hex')).toBe(
      Buffer.from(kp2.signing.publicKey).toString('hex'),
    );
    expect(Buffer.from(kp1.exchange.publicKey).toString('hex')).toBe(
      Buffer.from(kp2.exchange.publicKey).toString('hex'),
    );
  }, 30_000);

  it('deux seeds différents → deux keypairs différents', async () => {
    const p1 = generateSeedPhrase();
    const p2 = generateSeedPhrase();
    const kp1 = await deriveDeviceKeypair(p1);
    const kp2 = await deriveDeviceKeypair(p2);
    expect(Buffer.from(kp1.signing.publicKey).toString('hex')).not.toBe(
      Buffer.from(kp2.signing.publicKey).toString('hex'),
    );
  }, 30_000);

  it('le keypair signing peut signer et vérifier', async () => {
    const phrase = generateSeedPhrase();
    const kp = await deriveDeviceKeypair(phrase);
    const message = new TextEncoder().encode('événement:dose_administered');
    const sig = await sign(message, kp.signing.secretKey);
    const { verify } = await import('../sign/ed25519.js');
    const ok = await verify(message, sig, kp.signing.publicKey);
    expect(ok).toBe(true);
  }, 15_000);

  it('le keypair exchange peut établir des clés de session', async () => {
    const phrase = generateSeedPhrase();
    const deviceKp = await deriveDeviceKeypair(phrase);
    const server = await generateKeyExchangeKeypair();
    const clientKeys = await clientSessionKeys(deviceKp.exchange, server.publicKey);
    const serverKeys = await serverSessionKeys(server, deviceKp.exchange.publicKey);
    expect(Buffer.from(clientKeys.sharedRx).toString('hex')).toBe(
      Buffer.from(serverKeys.sharedTx).toString('hex'),
    );
  }, 15_000);

  it('lève sur une phrase BIP39 invalide', async () => {
    await expect(deriveDeviceKeypair('mots invalides bip39')).rejects.toThrow();
  }, 5_000);

  it('sel de domaine = SHA-256("kinhale:device-keypair:v1")[0:16] (valeur fixe)', async () => {
    // Calculé indépendamment via Node.js crypto.createHash
    // Si ce test échoue, TOUTES les clés device dérivées sont invalidées — ne pas modifier sans ADR
    const { sha256HexFromString } = await import('../hash/sha256.js');
    const { getSodium } = await import('../sodium.js');
    const hashHex = await sha256HexFromString('kinhale:device-keypair:v1');
    const sodium = await getSodium();
    const saltBytes = sodium.from_hex(hashHex).slice(0, sodium.crypto_pwhash_SALTBYTES);
    const saltHex = Buffer.from(saltBytes).toString('hex');
    expect(saltHex).toBe('2c520690617ac0702ef50d038eb0329f');
  }, 5_000);

  it('vecteur connu : abandon×23+art → clés déterministes (ADR anchor)', async () => {
    // Vecteur de régression — NE PAS MODIFIER sans ADR + review lead crypto
    // Phrase BIP39 officielle (entropie 0x00×32)
    const phrase =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
    const kp = await deriveDeviceKeypair(phrase);
    // Ces valeurs ont été calculées via la pipeline Argon2id+Ed25519 — toute modification
    // de la pipeline (params Argon2id, encodage de l'entropie, sel de domaine) DOIT
    // invalider ce test et déclencher une review du lead crypto
    expect(Buffer.from(kp.signing.publicKey).toString('hex')).toBe(
      '070316adcc9f75f8a3884f056536bfa1d54a156baa9840aa8f94080597af5886',
    );
    expect(Buffer.from(kp.exchange.publicKey).toString('hex')).toBe(
      'dcd40151e219f78fb9bdb2740e654e16e8a9eb7a419c19a64aab17b0b18fad0e',
    );
  }, 30_000);
});
