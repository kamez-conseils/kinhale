import { sign, verify } from '@kinhale/crypto';
import type { SignedEventRecord } from '../doc/schema.js';
import type { UnsignedEvent } from './types.js';

/**
 * Retourne les bytes canoniques à signer pour un UnsignedEvent.
 * JSON.stringify avec clés ordonnées pour déterminisme.
 */
export function canonicalBytes(unsigned: UnsignedEvent): Uint8Array {
  const canonical = JSON.stringify({
    id: unsigned.id,
    type: unsigned.event.type,
    payloadJson: JSON.stringify(unsigned.event.payload),
    deviceId: unsigned.deviceId,
    occurredAtMs: unsigned.occurredAtMs,
  });
  return new TextEncoder().encode(canonical);
}

/**
 * Signe un événement domaine avec la clé Ed25519 du device.
 * secretKey libsodium = 64 bytes : [32 seed][32 publicKey].
 */
export async function signEvent(
  unsigned: UnsignedEvent,
  secretKey: Uint8Array,
): Promise<SignedEventRecord> {
  const signerPublicKey = secretKey.slice(32, 64);
  const payloadJson = JSON.stringify(unsigned.event.payload);
  const bytes = canonicalBytes(unsigned);
  const signature = await sign(bytes, secretKey);

  return {
    id: unsigned.id,
    type: unsigned.event.type,
    payloadJson,
    signerPublicKeyHex: Buffer.from(signerPublicKey).toString('hex'),
    signatureHex: Buffer.from(signature).toString('hex'),
    deviceId: unsigned.deviceId,
    occurredAtMs: unsigned.occurredAtMs,
  };
}

/**
 * Vérifie la signature Ed25519 d'un SignedEventRecord.
 * Retourne false (jamais throw) si la signature est invalide ou corrompue.
 */
export async function verifySignedEvent(record: SignedEventRecord): Promise<boolean> {
  try {
    const parsedPayload = JSON.parse(record.payloadJson) as UnsignedEvent['event']['payload'];
    const unsigned: UnsignedEvent = {
      id: record.id,
      deviceId: record.deviceId,
      occurredAtMs: record.occurredAtMs,
      event: {
        type: record.type as UnsignedEvent['event']['type'],
        payload: parsedPayload,
      } as UnsignedEvent['event'],
    };
    const bytes = canonicalBytes(unsigned);
    const signature = Buffer.from(record.signatureHex, 'hex');
    const publicKey = Buffer.from(record.signerPublicKeyHex, 'hex');
    return await verify(bytes, signature, publicKey);
  } catch {
    return false;
  }
}
