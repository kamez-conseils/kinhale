import { describe, it, expect } from 'vitest'
import { getSodium } from './sodium.js'

describe('getSodium', () => {
  it('retourne une instance libsodium initialisée', async () => {
    const sodium = await getSodium()
    expect(sodium.SODIUM_VERSION_STRING).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('retourne la même instance au second appel', async () => {
    const a = await getSodium()
    const b = await getSodium()
    expect(a).toBe(b)
  })
})
