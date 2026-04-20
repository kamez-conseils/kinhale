import { describe, expect, it } from 'vitest';
import type { Invitation } from '../entities/invitation';
import { DomainError } from '../errors';
import {
  ensureInviteeConsentValid,
  type InviteeConsent,
  isInviteeConsentValid,
} from './rm22-invitee-consent';

const NOW = new Date('2026-04-19T12:00:00Z');

function makeInvitation(overrides: Partial<Invitation> & { id: string }): Invitation {
  return {
    householdId: 'h1',
    targetRole: 'contributor',
    status: 'active',
    createdByUserId: 'admin-1',
    createdAtUtc: new Date('2026-04-15T12:00:00Z'),
    expiresAtUtc: new Date('2026-04-22T12:00:00Z'),
    consumedAtUtc: null,
    consumedByUserId: null,
    revokedAtUtc: null,
    maxUses: 1,
    usesCount: 0,
    ...overrides,
  };
}

function makeConsent(
  overrides: Partial<InviteeConsent> & { invitationId: string },
): InviteeConsent {
  return {
    acceptsOwnDataProcessing: true,
    acknowledgesNotConsentingForChild: true,
    consentedAtUtc: new Date('2026-04-19T11:59:00Z'),
    inviteeUserId: 'user-42',
    ...overrides,
  };
}

describe('RM22 — ensureInviteeConsentValid (chemin nominal)', () => {
  it('accepte un consentement complet sur une invitation active non expirée', () => {
    const invitation = makeInvitation({ id: 'inv-1' });
    const consent = makeConsent({ invitationId: 'inv-1' });

    expect(() =>
      ensureInviteeConsentValid({
        consent,
        invitation,
        nowUtc: NOW,
      }),
    ).not.toThrow();
  });
});

describe('RM22 — ensureInviteeConsentValid (cas de refus)', () => {
  it('refuse si acceptsOwnDataProcessing = false (RM22_MISSING_INVITEE_CONSENT)', () => {
    const invitation = makeInvitation({ id: 'inv-1' });
    const consent = makeConsent({ invitationId: 'inv-1', acceptsOwnDataProcessing: false });

    try {
      ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM22_MISSING_INVITEE_CONSENT');
    }
  });

  it('refuse si acknowledgesNotConsentingForChild = false (RM22_INVITEE_CANNOT_CONSENT_FOR_CHILD)', () => {
    const invitation = makeInvitation({ id: 'inv-1' });
    const consent = makeConsent({
      invitationId: 'inv-1',
      acknowledgesNotConsentingForChild: false,
    });

    try {
      ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM22_INVITEE_CANNOT_CONSENT_FOR_CHILD');
    }
  });

  it('refuse si invitation consumed (RM22_INVITATION_NOT_ACTIVE)', () => {
    const invitation = makeInvitation({
      id: 'inv-1',
      status: 'consumed',
      consumedAtUtc: new Date('2026-04-18T12:00:00Z'),
      consumedByUserId: 'other-user',
    });
    const consent = makeConsent({ invitationId: 'inv-1' });

    try {
      ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM22_INVITATION_NOT_ACTIVE');
      expect((err as DomainError).context).toMatchObject({
        invitationId: 'inv-1',
      });
      // Ne doit PAS fuiter le statut exact : un attaquant connaissant
      // seulement un invitationId ne peut pas distinguer consumed / expired
      // / revoked via le context.
      expect((err as DomainError).context).not.toHaveProperty('invitationStatus');
    }
  });

  it('refuse si invitation expired (RM22_INVITATION_NOT_ACTIVE)', () => {
    const invitation = makeInvitation({ id: 'inv-1', status: 'expired' });
    const consent = makeConsent({ invitationId: 'inv-1' });

    try {
      ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM22_INVITATION_NOT_ACTIVE');
    }
  });

  it('refuse si invitation revoked (RM22_INVITATION_NOT_ACTIVE)', () => {
    const invitation = makeInvitation({
      id: 'inv-1',
      status: 'revoked',
      revokedAtUtc: new Date('2026-04-18T12:00:00Z'),
    });
    const consent = makeConsent({ invitationId: 'inv-1' });

    try {
      ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM22_INVITATION_NOT_ACTIVE');
    }
  });

  it("refuse si l'invitation est active mais expiresAtUtc < consentedAtUtc (RM22_INVITATION_EXPIRED)", () => {
    const invitation = makeInvitation({
      id: 'inv-1',
      status: 'active',
      expiresAtUtc: new Date('2026-04-19T11:00:00Z'),
    });
    const consent = makeConsent({
      invitationId: 'inv-1',
      consentedAtUtc: new Date('2026-04-19T11:30:00Z'),
    });

    try {
      ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM22_INVITATION_EXPIRED');
      expect((err as DomainError).context).toMatchObject({
        invitationId: 'inv-1',
      });
      expect((err as DomainError).context).not.toHaveProperty('invitationStatus');
    }
  });

  it('refuse si consent.invitationId ≠ invitation.id (RM22_CONSENT_INVITATION_MISMATCH)', () => {
    const invitation = makeInvitation({ id: 'inv-1' });
    const consent = makeConsent({ invitationId: 'inv-999' });

    try {
      ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM22_CONSENT_INVITATION_MISMATCH');
    }
  });

  it('refuse si consentedAtUtc > nowUtc + tolérance (RM22_INVALID_CONSENT_TIMESTAMP)', () => {
    const invitation = makeInvitation({ id: 'inv-1' });
    // NOW = 12:00:00Z ; tolérance = 1 s ; consent à 12:00:02Z → refus
    const consent = makeConsent({
      invitationId: 'inv-1',
      consentedAtUtc: new Date('2026-04-19T12:00:02Z'),
    });

    try {
      ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM22_INVALID_CONSENT_TIMESTAMP');
    }
  });

  it('accepte consentedAtUtc légèrement dans le futur (< tolérance NTP RM14)', () => {
    const invitation = makeInvitation({ id: 'inv-1' });
    // NOW = 12:00:00Z ; tolérance = 1 s ; consent à 12:00:00.500Z → OK
    const consent = makeConsent({
      invitationId: 'inv-1',
      consentedAtUtc: new Date('2026-04-19T12:00:00.500Z'),
    });

    expect(() => ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW })).not.toThrow();
  });

  it('accepte consentedAtUtc exactement à la borne de tolérance (nowUtc + 1000 ms)', () => {
    const invitation = makeInvitation({ id: 'inv-1' });
    const consent = makeConsent({
      invitationId: 'inv-1',
      consentedAtUtc: new Date('2026-04-19T12:00:01.000Z'),
    });

    expect(() => ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW })).not.toThrow();
  });

  it('accepte expiresAtUtc égal pile à consentedAtUtc (borne inclusive)', () => {
    // La spec ne tranche pas, la règle autorise l'égalité : un consentement
    // arrivé à la milliseconde pile de l'expiration reste valide.
    const consentedAt = new Date('2026-04-19T11:45:00Z');
    const invitation = makeInvitation({
      id: 'inv-1',
      status: 'active',
      expiresAtUtc: consentedAt,
    });
    const consent = makeConsent({
      invitationId: 'inv-1',
      consentedAtUtc: consentedAt,
    });

    expect(() => ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW })).not.toThrow();
  });
});

describe("RM22 — ensureInviteeConsentValid (confidentialité du context d'erreur)", () => {
  it('ne fuit pas inviteeUserId ni email dans le context', () => {
    const invitation = makeInvitation({ id: 'inv-1', status: 'revoked' });
    const consent = makeConsent({
      invitationId: 'inv-1',
      inviteeUserId: 'secret-user-xyz',
    });

    try {
      ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      const ctx = (err as DomainError).context ?? {};
      expect(JSON.stringify(ctx)).not.toContain('secret-user-xyz');
      expect(ctx).not.toHaveProperty('inviteeUserId');
    }
  });

  it('inclut invitationId et expiresAtUtc mais PAS invitationStatus dans le context', () => {
    const invitation = makeInvitation({ id: 'inv-1', status: 'expired' });
    const consent = makeConsent({ invitationId: 'inv-1' });

    try {
      ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      const ctx = (err as DomainError).context ?? {};
      expect(ctx).toMatchObject({
        invitationId: 'inv-1',
        expiresAtUtc: invitation.expiresAtUtc.toISOString(),
      });
      expect(ctx).not.toHaveProperty('invitationStatus');
    }
  });
});

describe('RM22 — ensureInviteeConsentValid (pureté)', () => {
  it("ne mute ni le consent ni l'invitation", () => {
    const invitation = makeInvitation({ id: 'inv-1' });
    const consent = makeConsent({ invitationId: 'inv-1' });
    const invitationSnap = JSON.stringify(invitation);
    const consentSnap = JSON.stringify(consent);

    ensureInviteeConsentValid({ consent, invitation, nowUtc: NOW });

    expect(JSON.stringify(invitation)).toBe(invitationSnap);
    expect(JSON.stringify(consent)).toBe(consentSnap);
  });
});

describe('RM22 — isInviteeConsentValid', () => {
  it('retourne true quand le consentement est valide', () => {
    const invitation = makeInvitation({ id: 'inv-1' });
    const consent = makeConsent({ invitationId: 'inv-1' });

    expect(isInviteeConsentValid({ consent, invitation, nowUtc: NOW })).toBe(true);
  });

  it('retourne false quand le consentement est invalide, sans lever', () => {
    const invitation = makeInvitation({ id: 'inv-1' });
    const consent = makeConsent({ invitationId: 'inv-1', acceptsOwnDataProcessing: false });

    expect(isInviteeConsentValid({ consent, invitation, nowUtc: NOW })).toBe(false);
  });

  it('retourne false quand invitation expirée', () => {
    const invitation = makeInvitation({ id: 'inv-1', status: 'expired' });
    const consent = makeConsent({ invitationId: 'inv-1' });

    expect(isInviteeConsentValid({ consent, invitation, nowUtc: NOW })).toBe(false);
  });
});
