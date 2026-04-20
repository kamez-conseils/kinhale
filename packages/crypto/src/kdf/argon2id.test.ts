import { describe, it, expect } from 'vitest'
import { deriveKey, generateSalt, ARGON2ID_PARAMS } from './argon2id.js'

describe('Argon2id', () => {
  it('dérive une clé de longueur demandée', async () => {
    const salt = await generateSalt()
    const key = await deriveKey('recovery seed mnemonic 24 words', salt, 32)
    expect(key).toHaveLength(32)
  }, 15_000)

  it('deux appels identiques produisent la même clé', async () => {
    const salt = await generateSalt()
    const password = 'correct horse battery staple'
    const k1 = await deriveKey(password, salt, 32)
    const k2 = await deriveKey(password, salt, 32)
    expect(Buffer.from(k1).toString('hex')).toBe(Buffer.from(k2).toString('hex'))
  }, 30_000)

  it('un salt différent produit une clé différente', async () => {
    const s1 = await generateSalt()
    const s2 = await generateSalt()
    const password = 'correct horse battery staple'
    const k1 = await deriveKey(password, s1, 32)
    const k2 = await deriveKey(password, s2, 32)
    expect(Buffer.from(k1).toString('hex')).not.toBe(Buffer.from(k2).toString('hex'))
  }, 30_000)

  it('expose les paramètres Argon2id conformes OWASP 2024', () => {
    expect(ARGON2ID_PARAMS.memoryCost).toBeGreaterThanOrEqual(65536)
    expect(ARGON2ID_PARAMS.timeCost).toBeGreaterThanOrEqual(3)
  })
})
