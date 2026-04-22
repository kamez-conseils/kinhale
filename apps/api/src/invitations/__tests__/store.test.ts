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
});
