import { getSodium } from '../sodium.js'

export async function randomBytes(n: number): Promise<Uint8Array> {
  const sodium = await getSodium()
  return sodium.randombytes_buf(n)
}
