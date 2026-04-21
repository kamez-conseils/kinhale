import { generateSigningKeypair, sha256HexFromString } from '@kinhale/crypto';
import type { SigningKeypair } from '@kinhale/crypto';

const DEVICE_KEY_STORAGE = 'kinhale-device-key';

interface StoredKeypair {
  publicKeyHex: string;
  secretKeyBase64: string;
}

export interface DeviceKeypair extends SigningKeypair {
  publicKeyHex: string;
}

export async function getOrCreateDevice(): Promise<DeviceKeypair> {
  const stored = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (stored !== null) {
    const parsed = JSON.parse(stored) as StoredKeypair;
    return {
      publicKey: new Uint8Array(Buffer.from(parsed.publicKeyHex, 'hex')),
      secretKey: new Uint8Array(Buffer.from(parsed.secretKeyBase64, 'base64')),
      publicKeyHex: parsed.publicKeyHex,
    };
  }
  const kp = await generateSigningKeypair();
  const data: StoredKeypair = {
    publicKeyHex: Buffer.from(kp.publicKey).toString('hex'),
    secretKeyBase64: Buffer.from(kp.secretKey).toString('base64'),
  };
  localStorage.setItem(DEVICE_KEY_STORAGE, JSON.stringify(data));
  return { ...kp, publicKeyHex: data.publicKeyHex };
}

// TODO KIN-023 : dérivation de clé de groupe non sécurisée — dev uniquement
export async function getGroupKey(householdId: string): Promise<Uint8Array> {
  const hex = await sha256HexFromString(`${householdId}:kinhale-dev-v1`);
  return new Uint8Array(Buffer.from(hex, 'hex'));
}
