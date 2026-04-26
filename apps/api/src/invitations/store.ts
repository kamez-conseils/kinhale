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
  /**
   * Clé publique X25519 (hex 64 chars) du device invité, déposée lors du
   * `POST /invitations/:token/accept`. L'admin l'utilise ensuite pour
   * sceller la `groupKey` via `sealedBoxEncrypt`. Absent tant que l'invité
   * n'a pas accepté. Refs: KIN-096 issue #352.
   */
  recipientPublicKeyHex?: string;
  /**
   * `crypto_box_seal(groupKey, recipientPublicKey)` encodé en hex. Déposé
   * par l'admin via `POST /invitations/:token/seal`. Absent tant que
   * l'admin n'a pas finalisé. Le relais ne sait pas déchiffrer.
   */
  sealedGroupKeyHex?: string;
}

const INVITATION_TTL_SECONDS = 600; // 10 min (COMPLIANCE_QR)
/**
 * TTL prolongé après acceptation : laisse à l'admin une fenêtre raisonnable
 * pour sceller la `groupKey` (peut nécessiter d'ouvrir l'app sur un autre
 * device). 1h reste compatible avec une exposition courte du record en
 * Redis. Refs: KIN-096 §lifecycle.
 */
const POST_ACCEPT_TTL_SECONDS = 3600; // 1h
const LOCK_TTL_SECONDS = 900; // 15 min après 3 PINs faux

const keyRecord = (token: string) => `inv:${token}`;
const keyHousehold = (householdId: string) => `inv:hh:${householdId}`;
const keyAttempts = (token: string) => `inv:att:${token}`;
const keyLock = (token: string) => `inv:lock:${token}`;

/**
 * Store Redis pour les tickets d'invitation aidant (W5/W6).
 * TTL 10 min (COMPLIANCE_QR) ; verrouillage 15 min après 3 PINs faux.
 * Aucune donnée santé : le store ne voit que householdId opaque + hash PIN.
 *
 * Cycle de vie KIN-096 (envelope X25519) :
 * 1. `create()` — TTL 10 min, états vides.
 * 2. `markAccepted(token, recipientPublicKeyHex)` — PIN OK, TTL prolongé
 *    à 1h pour laisser à l'admin le temps de sceller la `groupKey`.
 * 3. `markSealed(token, sealedGroupKeyHex)` — admin a chiffré la groupKey.
 * 4. `consume()` — invité a récupéré le sealed (ou révocation Admin).
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

  /**
   * Marque l'invitation comme acceptée par un device dont la clé publique
   * X25519 est `recipientPublicKeyHex`. Étend le TTL de la clé Redis à
   * `POST_ACCEPT_TTL_SECONDS` pour laisser à l'admin le temps de sceller.
   *
   * Idempotent : si déjà acceptée, on **n'écrase pas** la clé publique
   * existante (anti-rebind — un attaquant qui aurait dérobé le token + PIN
   * ne peut pas remplacer la pubkey d'un invité honnête déjà inscrit).
   *
   * @returns le record mis à jour, ou `null` si l'invitation n'existe pas.
   */
  async markAccepted(
    token: string,
    recipientPublicKeyHex: string,
  ): Promise<InvitationRecord | null> {
    const record = await this.get(token);
    if (record === null) return null;
    if (record.recipientPublicKeyHex !== undefined) {
      // Déjà accepté — on prolonge éventuellement le TTL mais on ne
      // remplace pas la clé publique. Anti-rebind.
      await this.redis.pub.expire(keyRecord(token), POST_ACCEPT_TTL_SECONDS);
      return record;
    }
    const updated: InvitationRecord = { ...record, recipientPublicKeyHex };
    await this.redis.pub.setex(keyRecord(token), POST_ACCEPT_TTL_SECONDS, JSON.stringify(updated));
    await this.redis.pub.expire(keyHousehold(record.householdId), POST_ACCEPT_TTL_SECONDS);
    return updated;
  }

  /**
   * Persiste l'envelope X25519 (sealed box hex) déposée par l'admin du
   * foyer. Conserve le TTL Redis restant. Préserve les autres champs.
   *
   * @returns le record mis à jour, ou `null` si l'invitation n'existe pas.
   */
  async markSealed(token: string, sealedGroupKeyHex: string): Promise<InvitationRecord | null> {
    const record = await this.get(token);
    if (record === null) return null;
    const updated: InvitationRecord = { ...record, sealedGroupKeyHex };
    // On préserve le TTL existant (pas d'extension supplémentaire).
    const remaining = await this.redis.pub.ttl(keyRecord(token));
    const ttl = remaining > 0 ? remaining : POST_ACCEPT_TTL_SECONDS;
    await this.redis.pub.setex(keyRecord(token), ttl, JSON.stringify(updated));
    return updated;
  }

  /**
   * Liste les invitations actives d'un foyer (admin Caregivers list).
   */
  async listByHousehold(householdId: string): Promise<InvitationRecord[]> {
    const tokens = await this.redis.pub.smembers(keyHousehold(householdId));
    const results = await Promise.all(tokens.map((t) => this.get(t)));
    return results.filter((r): r is InvitationRecord => r !== null);
  }
}
