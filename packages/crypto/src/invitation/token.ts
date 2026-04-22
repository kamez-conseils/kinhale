import { getSodium } from '../sodium.js';
import { toHex } from '../encode/index.js';

export async function generateInvitationToken(): Promise<string> {
  const sodium = await getSodium();
  const bytes = sodium.randombytes_buf(32);
  return toHex(bytes);
}
