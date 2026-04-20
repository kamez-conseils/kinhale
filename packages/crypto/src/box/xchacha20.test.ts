import { describe, it, expect } from 'vitest'
import {
  secretboxKeygen,
  secretboxNonce,
  secretbox,
  secretboxOpen,
} from './xchacha20.js'

describe('XChaCha20-Poly1305', () => {
  it('génère une clé de 32 octets', async () => {
    const key = await secretboxKeygen()
    expect(key).toHaveLength(32)
  })

  it('génère un nonce de 24 octets', async () => {
    const nonce = await secretboxNonce()
    expect(nonce).toHaveLength(24)
  })

  it('chiffre et déchiffre un blob', async () => {
    const key = await secretboxKeygen()
    const nonce = await secretboxNonce()
    const plaintext = new TextEncoder().encode('données santé chiffrées')
    const ciphertext = await secretbox(plaintext, nonce, key)
    expect(ciphertext.length).toBeGreaterThan(plaintext.length)
    const decrypted = await secretboxOpen(ciphertext, nonce, key)
    expect(new TextDecoder().decode(decrypted)).toBe('données santé chiffrées')
  })

  it('rejette un ciphertext altéré', async () => {
    const key = await secretboxKeygen()
    const nonce = await secretboxNonce()
    const plaintext = new TextEncoder().encode('données santé chiffrées')
    const ciphertext = await secretbox(plaintext, nonce, key)
    ciphertext[0] ^= 0xff
    await expect(secretboxOpen(ciphertext, nonce, key)).rejects.toThrow()
  })

  it('deux nonces différents produisent deux ciphertexts différents', async () => {
    const key = await secretboxKeygen()
    const n1 = await secretboxNonce()
    const n2 = await secretboxNonce()
    const msg = new TextEncoder().encode('test')
    const c1 = await secretbox(msg, n1, key)
    const c2 = await secretbox(msg, n2, key)
    expect(Buffer.from(c1).toString('hex')).not.toBe(Buffer.from(c2).toString('hex'))
  })
})
