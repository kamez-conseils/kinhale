import { describe, it, expect } from 'vitest'
import {
  generateSigningKeypair,
  sign,
  verify,
} from './ed25519.js'

describe('Ed25519', () => {
  it('génère une paire de clés valide (32 + 64 octets)', async () => {
    const kp = await generateSigningKeypair()
    expect(kp.publicKey).toHaveLength(32)
    expect(kp.secretKey).toHaveLength(64)
  })

  it('signe un message et le vérifie correctement', async () => {
    const kp = await generateSigningKeypair()
    const message = new TextEncoder().encode('événement:dose_administered')
    const sig = await sign(message, kp.secretKey)
    expect(sig).toHaveLength(64)
    const ok = await verify(message, sig, kp.publicKey)
    expect(ok).toBe(true)
  })

  it('rejette une signature modifiée', async () => {
    const kp = await generateSigningKeypair()
    const message = new TextEncoder().encode('événement:dose_administered')
    const sig = await sign(message, kp.secretKey)
    sig[0] ^= 0xff
    const ok = await verify(message, sig, kp.publicKey)
    expect(ok).toBe(false)
  })

  it('rejette une signature avec la mauvaise clé publique', async () => {
    const kp1 = await generateSigningKeypair()
    const kp2 = await generateSigningKeypair()
    const message = new TextEncoder().encode('événement:dose_administered')
    const sig = await sign(message, kp1.secretKey)
    const ok = await verify(message, sig, kp2.publicKey)
    expect(ok).toBe(false)
  })
})
