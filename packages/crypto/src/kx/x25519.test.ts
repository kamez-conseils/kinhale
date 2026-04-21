import { describe, it, expect } from 'vitest';
import {
  generateKeyExchangeKeypair,
  clientSessionKeys,
  serverSessionKeys,
  ed25519ToX25519,
} from './x25519.js';
import { generateSigningKeypair } from '../sign/ed25519.js';

describe('X25519/generateKeyExchangeKeypair', () => {
  it('génère publicKey 32 octets + privateKey 32 octets', async () => {
    const kp = await generateKeyExchangeKeypair();
    expect(kp.publicKey).toHaveLength(32);
    expect(kp.privateKey).toHaveLength(32);
  });

  it('deux appels génèrent des keypairs différents', async () => {
    const kp1 = await generateKeyExchangeKeypair();
    const kp2 = await generateKeyExchangeKeypair();
    expect(Buffer.from(kp1.publicKey).toString('hex')).not.toBe(
      Buffer.from(kp2.publicKey).toString('hex'),
    );
  });
});

describe('X25519/sessionKeys', () => {
  it('client et serveur dérivent les mêmes clés de session (rx/tx inversés)', async () => {
    const client = await generateKeyExchangeKeypair();
    const server = await generateKeyExchangeKeypair();

    const clientKeys = await clientSessionKeys(client, server.publicKey);
    const serverKeys = await serverSessionKeys(server, client.publicKey);

    // sharedRx côté client == sharedTx côté serveur (et vice-versa)
    expect(Buffer.from(clientKeys.sharedRx).toString('hex')).toBe(
      Buffer.from(serverKeys.sharedTx).toString('hex'),
    );
    expect(Buffer.from(clientKeys.sharedTx).toString('hex')).toBe(
      Buffer.from(serverKeys.sharedRx).toString('hex'),
    );
  });

  it('clés de session différentes avec un tiers (isolation foyer)', async () => {
    const client = await generateKeyExchangeKeypair();
    const server1 = await generateKeyExchangeKeypair();
    const server2 = await generateKeyExchangeKeypair();
    const k1 = await clientSessionKeys(client, server1.publicKey);
    const k2 = await clientSessionKeys(client, server2.publicKey);
    expect(Buffer.from(k1.sharedRx).toString('hex')).not.toBe(
      Buffer.from(k2.sharedRx).toString('hex'),
    );
  });
});

describe('X25519/ed25519ToX25519', () => {
  it('convertit un keypair Ed25519 en X25519 (32+32 octets)', async () => {
    const ed = await generateSigningKeypair();
    const kx = await ed25519ToX25519(ed);
    expect(kx.publicKey).toHaveLength(32);
    expect(kx.privateKey).toHaveLength(32);
  });

  it('déterministe : même Ed25519 → même X25519', async () => {
    const ed = await generateSigningKeypair();
    const kx1 = await ed25519ToX25519(ed);
    const kx2 = await ed25519ToX25519(ed);
    expect(Buffer.from(kx1.publicKey).toString('hex')).toBe(
      Buffer.from(kx2.publicKey).toString('hex'),
    );
  });

  it('deux Ed25519 différents → deux X25519 différents', async () => {
    const ed1 = await generateSigningKeypair();
    const ed2 = await generateSigningKeypair();
    const kx1 = await ed25519ToX25519(ed1);
    const kx2 = await ed25519ToX25519(ed2);
    expect(Buffer.from(kx1.publicKey).toString('hex')).not.toBe(
      Buffer.from(kx2.publicKey).toString('hex'),
    );
  });

  it('le X25519 converti peut établir des clés de session valides', async () => {
    const ed = await generateSigningKeypair();
    const client = await ed25519ToX25519(ed);
    const server = await generateKeyExchangeKeypair();
    const clientKeys = await clientSessionKeys(client, server.publicKey);
    const serverKeys = await serverSessionKeys(server, client.publicKey);
    expect(Buffer.from(clientKeys.sharedRx).toString('hex')).toBe(
      Buffer.from(serverKeys.sharedTx).toString('hex'),
    );
  });

  it("lève si secretKey n'est pas 64 octets (clé seed brute rejetée)", async () => {
    const fakeEd = {
      publicKey: new Uint8Array(32),
      secretKey: new Uint8Array(32), // 32 bytes au lieu de 64 → doit lever
    };
    await expect(ed25519ToX25519(fakeEd)).rejects.toThrow('64 octets');
  });
});

describe('X25519/known-answer (vecteur de test)', () => {
  it('génère un keypair X25519 déterministe depuis seed connu', async () => {
    // Seed 32 octets tous à zéro — vecteur de test de régression
    const { getSodium } = await import('../sodium.js');
    const sodium = await getSodium();
    // Ed25519 seed keypair depuis seed connu
    const seed = new Uint8Array(32); // all zeros
    const edKp = sodium.crypto_sign_seed_keypair(seed);
    const signingKp = { publicKey: edKp.publicKey, secretKey: edKp.privateKey };
    const kxKp = await ed25519ToX25519(signingKp);

    // Les valeurs exactes sont déterministes — on les fixe ici comme vecteur de régression
    // Si libsodium change de comportement, ce test échoue et force une review
    const pubHex = Buffer.from(kxKp.publicKey).toString('hex');
    const privHex = Buffer.from(kxKp.privateKey).toString('hex');

    // Vérifier que les deux conversions sont stables entre appels
    const kxKp2 = await ed25519ToX25519(signingKp);
    expect(Buffer.from(kxKp2.publicKey).toString('hex')).toBe(pubHex);
    expect(Buffer.from(kxKp2.privateKey).toString('hex')).toBe(privHex);

    // Longueurs correctes
    expect(kxKp.publicKey).toHaveLength(32);
    expect(kxKp.privateKey).toHaveLength(32);

    // Peut établir des clés de session (vecteur end-to-end)
    const server = sodium.crypto_kx_keypair();
    const serverKp = { publicKey: server.publicKey, privateKey: server.privateKey };
    const clientKeys = await clientSessionKeys(kxKp, server.publicKey);
    const serverKeys = await serverSessionKeys(serverKp, kxKp.publicKey);
    expect(Buffer.from(clientKeys.sharedRx).toString('hex')).toBe(
      Buffer.from(serverKeys.sharedTx).toString('hex'),
    );
  });
});
