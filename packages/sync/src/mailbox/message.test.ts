import { describe, it, expect } from 'vitest'
import { encodeSyncMessage, decodeSyncMessage } from './message.js'
import type { SyncMessage } from './message.js'

const makeMsg = (): SyncMessage => ({
  mailboxId: 'mailbox-opaque-001',
  deviceId: 'device-001',
  blob: { nonce: 'a'.repeat(48), ciphertext: 'b'.repeat(64) },
  seq: 1,
  sentAtMs: 1_700_000_000_000,
})

describe('SyncMessage encode/decode', () => {
  it('encodeSyncMessage retourne une string JSON valide', () => {
    const json = encodeSyncMessage(makeMsg())
    expect(typeof json).toBe('string')
    const parsed = JSON.parse(json)
    expect(parsed.mailboxId).toBe('mailbox-opaque-001')
    expect(parsed.seq).toBe(1)
  })

  it('decodeSyncMessage restitue le message original', () => {
    const original = makeMsg()
    const json = encodeSyncMessage(original)
    const decoded = decodeSyncMessage(json)
    expect(decoded.mailboxId).toBe(original.mailboxId)
    expect(decoded.deviceId).toBe(original.deviceId)
    expect(decoded.seq).toBe(original.seq)
    expect(decoded.blob.nonce).toBe(original.blob.nonce)
  })

  it('decodeSyncMessage throw sur JSON invalide', () => {
    expect(() => decodeSyncMessage('not json')).toThrow()
  })

  it('decodeSyncMessage throw si champ obligatoire manquant', () => {
    const incomplete = JSON.stringify({ mailboxId: 'x', deviceId: 'y' })
    expect(() => decodeSyncMessage(incomplete)).toThrow('sync: message invalide')
  })
})
