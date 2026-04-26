import { describe, it, expect, beforeEach } from 'vitest';
import type { RedisClients } from '../../plugins/redis.js';
import { InvitationStore, type InvitationRecord } from '../store.js';

function makeMockRedis(): RedisClients {
  const kv = new Map<string, string>();
  const sets = new Map<string, Set<string>>();

  const client = {
    async get(k: string) {
      return kv.get(k) ?? null;
    },
    async setex(k: string, _ttl: number, v: string) {
      kv.set(k, v);
      return 'OK';
    },
    async del(k: string) {
      const existed = kv.has(k);
      kv.delete(k);
      return existed ? 1 : 0;
    },
    async sadd(k: string, v: string) {
      const s = sets.get(k) ?? new Set<string>();
      const had = s.has(v);
      s.add(v);
      sets.set(k, s);
      return had ? 0 : 1;
    },
    async srem(k: string, v: string) {
      const s = sets.get(k);
      if (s === undefined) return 0;
      const removed = s.delete(v);
      return removed ? 1 : 0;
    },
    async scard(k: string) {
      return sets.get(k)?.size ?? 0;
    },
    async smembers(k: string) {
      return Array.from(sets.get(k) ?? []);
    },
    async incr(k: string) {
      const n = (Number(kv.get(k) ?? '0') || 0) + 1;
      kv.set(k, String(n));
      return n;
    },
    async expire(_k: string, _ttl: number) {
      return 1;
    },
    async ttl(k: string) {
      return kv.has(k) ? 600 : -2;
    },
  };

  // The mock only implements the subset of Redis methods used by InvitationStore.
  // The full ioredis Redis type has many more methods; we cast via unknown to avoid
  // listing every unused method while keeping no `any` in production code.
  return { pub: client, sub: client } as unknown as RedisClients;
}

const baseRecord: InvitationRecord = {
  token: 'tok-abc',
  householdId: 'h1',
  createdByUserId: 'u1',
  targetRole: 'restricted_contributor',
  displayName: 'Garderie',
  pinHash: '$argon2id$v=19$m=65536,t=2,p=1$abcd$efgh',
  pinAttempts: 0,
  createdAtMs: 1_700_000_000_000,
};

describe('InvitationStore', () => {
  let store: InvitationStore;
  beforeEach(() => {
    store = new InvitationStore(makeMockRedis());
  });

  it('persiste et retrouve une invitation par token', async () => {
    await store.create(baseRecord);
    const found = await store.get('tok-abc');
    expect(found).toMatchObject({ token: 'tok-abc', householdId: 'h1' });
  });

  it('retourne null pour un token inconnu', async () => {
    expect(await store.get('inconnu')).toBeNull();
  });

  it('compte les invitations actives par foyer (RM21)', async () => {
    await store.create(baseRecord);
    await store.create({ ...baseRecord, token: 'tok-2' });
    expect(await store.countActive('h1')).toBe(2);
  });

  it("supprime l'entrée à la consommation", async () => {
    await store.create(baseRecord);
    await store.consume('tok-abc');
    expect(await store.get('tok-abc')).toBeNull();
    expect(await store.countActive('h1')).toBe(0);
  });

  it('incrémente pinAttempts', async () => {
    await store.create(baseRecord);
    expect(await store.incrementPinAttempts('tok-abc')).toBe(1);
    expect(await store.incrementPinAttempts('tok-abc')).toBe(2);
  });

  it('isLocked retourne false par défaut, true après lock()', async () => {
    expect(await store.isLocked('tok-abc')).toBe(false);
    await store.lock('tok-abc');
    expect(await store.isLocked('tok-abc')).toBe(true);
  });

  describe('markAccepted (KIN-096 envelope X25519)', () => {
    const PUBKEY_HEX = 'aa'.repeat(32);

    it("ajoute la clé publique X25519 de l'invité et persiste", async () => {
      await store.create(baseRecord);
      const updated = await store.markAccepted('tok-abc', PUBKEY_HEX);
      expect(updated).not.toBeNull();
      expect(updated?.recipientPublicKeyHex).toBe(PUBKEY_HEX);

      const reloaded = await store.get('tok-abc');
      expect(reloaded?.recipientPublicKeyHex).toBe(PUBKEY_HEX);
    });

    it("retourne null si l'invitation n'existe pas", async () => {
      const updated = await store.markAccepted('inconnu', PUBKEY_HEX);
      expect(updated).toBeNull();
    });

    it('idempotent — ne remplace pas une clé publique existante (anti-rebind)', async () => {
      const FIRST = 'aa'.repeat(32);
      const SECOND = 'bb'.repeat(32);
      await store.create(baseRecord);
      await store.markAccepted('tok-abc', FIRST);
      const second = await store.markAccepted('tok-abc', SECOND);
      // Le second appel ne change pas la clé publique
      expect(second?.recipientPublicKeyHex).toBe(FIRST);
      const reloaded = await store.get('tok-abc');
      expect(reloaded?.recipientPublicKeyHex).toBe(FIRST);
    });
  });

  describe('markSealed (KIN-096 envelope X25519)', () => {
    const SEALED_HEX = 'cd'.repeat(80);

    it("persiste le sealedGroupKeyHex sur l'invitation", async () => {
      await store.create(baseRecord);
      await store.markAccepted('tok-abc', 'aa'.repeat(32));
      const updated = await store.markSealed('tok-abc', SEALED_HEX);
      expect(updated?.sealedGroupKeyHex).toBe(SEALED_HEX);
      const reloaded = await store.get('tok-abc');
      expect(reloaded?.sealedGroupKeyHex).toBe(SEALED_HEX);
      // Préserve la clé publique
      expect(reloaded?.recipientPublicKeyHex).toBe('aa'.repeat(32));
    });

    it("retourne null si l'invitation n'existe pas", async () => {
      const updated = await store.markSealed('inconnu', SEALED_HEX);
      expect(updated).toBeNull();
    });
  });

  describe('listByHousehold', () => {
    it('retourne les invitations actives du foyer', async () => {
      await store.create(baseRecord);
      await store.create({ ...baseRecord, token: 'tok-2' });
      const list = await store.listByHousehold('h1');
      expect(list).toHaveLength(2);
      expect(list.map((r) => r.token).sort()).toEqual(['tok-2', 'tok-abc']);
    });

    it('retourne [] si aucune invitation pour ce foyer', async () => {
      const list = await store.listByHousehold('h-vide');
      expect(list).toEqual([]);
    });
  });
});
