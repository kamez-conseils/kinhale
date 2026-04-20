import { describe, expect, it } from 'vitest';
import type { Invitation } from '../entities/invitation';
import {
  findInvitationsToPurge,
  PURGE_CONSUMED_AFTER_DAYS,
  PURGE_EXPIRED_AFTER_DAYS,
  PURGE_REVOKED_AFTER_DAYS,
} from './rm28-invitation-purge';

const NOW = new Date('2026-04-19T12:00:00Z');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * MS_PER_DAY);
}

function makeInvitation(overrides: Partial<Invitation> & { id: string }): Invitation {
  return {
    householdId: 'h1',
    targetRole: 'contributor',
    status: 'active',
    createdByUserId: 'admin-1',
    createdAtUtc: new Date('2025-01-01T00:00:00Z'),
    expiresAtUtc: new Date('2026-04-22T12:00:00Z'),
    consumedAtUtc: null,
    consumedByUserId: null,
    revokedAtUtc: null,
    maxUses: 1,
    usesCount: 0,
    ...overrides,
  };
}

describe('RM28 — findInvitationsToPurge (expired)', () => {
  it('ne purge PAS une invitation expired dont expiresAtUtc = now - 29 jours', () => {
    const invitations = [
      makeInvitation({
        id: 'i1',
        status: 'expired',
        expiresAtUtc: daysBefore(NOW, 29),
      }),
    ];
    expect(findInvitationsToPurge(invitations, NOW)).toEqual([]);
  });

  it('purge une invitation expired dont expiresAtUtc = now - 30 jours pile (borne inclusive)', () => {
    const expiresAtUtc = daysBefore(NOW, 30);
    const invitations = [makeInvitation({ id: 'i1', status: 'expired', expiresAtUtc })];
    const result = findInvitationsToPurge(invitations, NOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      invitationId: 'i1',
      reason: 'expired_retention_exceeded',
      referenceAtUtc: expiresAtUtc,
    });
  });

  it('purge une invitation expired dont expiresAtUtc = now - 31 jours', () => {
    const invitations = [
      makeInvitation({
        id: 'i1',
        status: 'expired',
        expiresAtUtc: daysBefore(NOW, 31),
      }),
    ];
    expect(findInvitationsToPurge(invitations, NOW)).toHaveLength(1);
  });

  it('retourne un retentionThresholdUtc = now - 30 jours pour expired', () => {
    const invitations = [
      makeInvitation({
        id: 'i1',
        status: 'expired',
        expiresAtUtc: daysBefore(NOW, 40),
      }),
    ];
    const [eligibility] = findInvitationsToPurge(invitations, NOW);
    expect(eligibility?.retentionThresholdUtc.getTime()).toBe(
      NOW.getTime() - PURGE_EXPIRED_AFTER_DAYS * MS_PER_DAY,
    );
  });
});

describe('RM28 — findInvitationsToPurge (consumed)', () => {
  it('ne purge PAS une invitation consumed dont consumedAtUtc = now - 89 jours', () => {
    const invitations = [
      makeInvitation({
        id: 'i1',
        status: 'consumed',
        consumedAtUtc: daysBefore(NOW, 89),
      }),
    ];
    expect(findInvitationsToPurge(invitations, NOW)).toEqual([]);
  });

  it('purge une invitation consumed dont consumedAtUtc = now - 90 jours pile (borne inclusive)', () => {
    const consumedAtUtc = daysBefore(NOW, 90);
    const invitations = [makeInvitation({ id: 'i1', status: 'consumed', consumedAtUtc })];
    const result = findInvitationsToPurge(invitations, NOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      invitationId: 'i1',
      reason: 'consumed_retention_exceeded',
      referenceAtUtc: consumedAtUtc,
    });
  });

  it('purge une invitation consumed dont consumedAtUtc = now - 91 jours', () => {
    const invitations = [
      makeInvitation({
        id: 'i1',
        status: 'consumed',
        consumedAtUtc: daysBefore(NOW, 91),
      }),
    ];
    expect(findInvitationsToPurge(invitations, NOW)).toHaveLength(1);
  });

  it('ignore défensivement une invitation consumed avec consumedAtUtc = null (incohérence)', () => {
    const invitations = [
      makeInvitation({
        id: 'i1',
        status: 'consumed',
        consumedAtUtc: null,
      }),
    ];
    expect(findInvitationsToPurge(invitations, NOW)).toEqual([]);
  });
});

describe('RM28 — findInvitationsToPurge (revoked, extension domaine)', () => {
  it('purge une invitation revoked dont revokedAtUtc = now - 31 jours', () => {
    const revokedAtUtc = daysBefore(NOW, 31);
    const invitations = [makeInvitation({ id: 'i1', status: 'revoked', revokedAtUtc })];
    const result = findInvitationsToPurge(invitations, NOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      invitationId: 'i1',
      reason: 'revoked_retention_exceeded',
      referenceAtUtc: revokedAtUtc,
    });
  });

  it('ne purge PAS une invitation revoked dont revokedAtUtc = now - 29 jours', () => {
    const invitations = [
      makeInvitation({
        id: 'i1',
        status: 'revoked',
        revokedAtUtc: daysBefore(NOW, 29),
      }),
    ];
    expect(findInvitationsToPurge(invitations, NOW)).toEqual([]);
  });

  it('purge une invitation revoked à 30 jours pile (borne inclusive)', () => {
    const invitations = [
      makeInvitation({
        id: 'i1',
        status: 'revoked',
        revokedAtUtc: daysBefore(NOW, PURGE_REVOKED_AFTER_DAYS),
      }),
    ];
    expect(findInvitationsToPurge(invitations, NOW)).toHaveLength(1);
  });

  it('ignore défensivement une invitation revoked avec revokedAtUtc = null', () => {
    const invitations = [
      makeInvitation({
        id: 'i1',
        status: 'revoked',
        revokedAtUtc: null,
      }),
    ];
    expect(findInvitationsToPurge(invitations, NOW)).toEqual([]);
  });
});

describe('RM28 — findInvitationsToPurge (active)', () => {
  it("n'inclut jamais une invitation active, même dont expiresAtUtc est depuis > 30 jours", () => {
    const invitations = [
      makeInvitation({
        id: 'i1',
        status: 'active',
        expiresAtUtc: daysBefore(NOW, 45),
      }),
    ];
    expect(findInvitationsToPurge(invitations, NOW)).toEqual([]);
  });

  it("n'inclut jamais une invitation active récente", () => {
    const invitations = [makeInvitation({ id: 'i1', status: 'active' })];
    expect(findInvitationsToPurge(invitations, NOW)).toEqual([]);
  });
});

describe('RM28 — findInvitationsToPurge (mix)', () => {
  it('retourne uniquement les invitations éligibles et les identifie correctement', () => {
    const invitations: Invitation[] = [
      makeInvitation({ id: 'active-new', status: 'active' }),
      makeInvitation({
        id: 'expired-recent',
        status: 'expired',
        expiresAtUtc: daysBefore(NOW, 10),
      }),
      makeInvitation({
        id: 'expired-old',
        status: 'expired',
        expiresAtUtc: daysBefore(NOW, 45),
      }),
      makeInvitation({
        id: 'consumed-recent',
        status: 'consumed',
        consumedAtUtc: daysBefore(NOW, 30),
      }),
      makeInvitation({
        id: 'consumed-old',
        status: 'consumed',
        consumedAtUtc: daysBefore(NOW, 120),
      }),
      makeInvitation({
        id: 'revoked-recent',
        status: 'revoked',
        revokedAtUtc: daysBefore(NOW, 5),
      }),
      makeInvitation({
        id: 'revoked-old',
        status: 'revoked',
        revokedAtUtc: daysBefore(NOW, 100),
      }),
    ];
    const result = findInvitationsToPurge(invitations, NOW);
    const ids = result.map((r) => r.invitationId).sort();
    expect(ids).toEqual(['consumed-old', 'expired-old', 'revoked-old']);
  });

  it('ne mute pas la liste passée en entrée (pureté)', () => {
    const invitations = [
      makeInvitation({
        id: 'expired-old',
        status: 'expired',
        expiresAtUtc: daysBefore(NOW, 45),
      }),
      makeInvitation({
        id: 'consumed-old',
        status: 'consumed',
        consumedAtUtc: daysBefore(NOW, 120),
      }),
    ];
    const snapshot = JSON.parse(JSON.stringify(invitations));
    findInvitationsToPurge(invitations, NOW);
    expect(JSON.parse(JSON.stringify(invitations))).toEqual(snapshot);
  });

  it('expose les constantes de rétention attendues', () => {
    expect(PURGE_EXPIRED_AFTER_DAYS).toBe(30);
    expect(PURGE_CONSUMED_AFTER_DAYS).toBe(90);
    expect(PURGE_REVOKED_AFTER_DAYS).toBe(30);
  });
});
