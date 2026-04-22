import type { RedisClients } from '../plugins/redis.js';

export interface InvitationRecord {
  token: string;
  householdId: string;
  createdByUserId: string;
  targetRole: 'contributor' | 'restricted_contributor';
  displayName: string;
  pinHash: string;
  pinAttempts: number;
  createdAtMs: number;
}

const INVITATION_TTL_SECONDS = 600; // 10 min (COMPLIANCE_QR)
const LOCK_TTL_SECONDS = 900; // 15 min après 3 PINs faux

const keyRecord = (token: string) => `inv:${token}`;
const keyHousehold = (householdId: string) => `inv:hh:${householdId}`;
const keyAttempts = (token: string) => `inv:att:${token}`;
const keyLock = (token: string) => `inv:lock:${token}`;

/**
 * Store Redis pour les tickets d'invitation aidant (W5/W6).
 * TTL 10 min (COMPLIANCE_QR) ; verrouillage 15 min après 3 PINs faux.
 * Aucune donnée santé : le store ne voit que householdId opaque + hash PIN.
 */
export class InvitationStore {
  constructor(private readonly redis: RedisClients) {}

  async create(record: InvitationRecord): Promise<void> {
    await this.redis.pub.setex(
      keyRecord(record.token),
      INVITATION_TTL_SECONDS,
      JSON.stringify(record),
    );
    await this.redis.pub.sadd(keyHousehold(record.householdId), record.token);
    await this.redis.pub.expire(keyHousehold(record.householdId), INVITATION_TTL_SECONDS);
  }

  async get(token: string): Promise<InvitationRecord | null> {
    const raw = await this.redis.pub.get(keyRecord(token));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as InvitationRecord;
    } catch {
      return null;
    }
  }

  async countActive(householdId: string): Promise<number> {
    return this.redis.pub.scard(keyHousehold(householdId));
  }

  async consume(token: string): Promise<void> {
    const record = await this.get(token);
    if (record === null) return;
    await this.redis.pub.del(keyRecord(token));
    await this.redis.pub.srem(keyHousehold(record.householdId), token);
  }

  async incrementPinAttempts(token: string): Promise<number> {
    const n = await this.redis.pub.incr(keyAttempts(token));
    if (n === 1) {
      await this.redis.pub.expire(keyAttempts(token), INVITATION_TTL_SECONDS);
    }
    return n;
  }

  async isLocked(token: string): Promise<boolean> {
    const lock = await this.redis.pub.get(keyLock(token));
    return lock !== null;
  }

  async lock(token: string): Promise<void> {
    await this.redis.pub.setex(keyLock(token), LOCK_TTL_SECONDS, '1');
  }
}
