import { describe, expect, it } from 'vitest';
import {
  EDIT_FREE_WINDOW_MINUTES,
  canEditDose,
  type DoseEditTarget,
} from './dose-edit-permissions';

const target = (overrides: Partial<DoseEditTarget> = {}): DoseEditTarget => ({
  recordedByDeviceId: 'dev-author',
  administeredAtMs: 1_000_000,
  status: 'recorded',
  ...overrides,
});

const FREE_WINDOW_MS = EDIT_FREE_WINDOW_MINUTES * 60_000;

describe('canEditDose', () => {
  it("autorise l'auteur sans raison dans la fenêtre de 30 min", () => {
    const result = canEditDose({
      dose: target(),
      currentDeviceId: 'dev-author',
      currentRole: 'contributor',
      nowMs: 1_000_000 + 5 * 60_000, // 5 min après
    });
    expect(result).toEqual({ allowed: true, requiresReason: false });
  });

  it("autorise l'auteur exactement à la borne 30 min (inclusive)", () => {
    const result = canEditDose({
      dose: target(),
      currentDeviceId: 'dev-author',
      currentRole: 'contributor',
      nowMs: 1_000_000 + FREE_WINDOW_MS,
    });
    expect(result).toEqual({ allowed: true, requiresReason: false });
  });

  it('refuse un contributor non-auteur après la fenêtre', () => {
    const result = canEditDose({
      dose: target(),
      currentDeviceId: 'dev-other',
      currentRole: 'contributor',
      nowMs: 1_000_000 + FREE_WINDOW_MS + 1,
    });
    expect(result).toEqual({ allowed: false, reason: 'not_author_and_too_old' });
  });

  it('autorise un Admin > 30 min mais avec raison obligatoire', () => {
    const result = canEditDose({
      dose: target(),
      currentDeviceId: 'dev-admin',
      currentRole: 'admin',
      nowMs: 1_000_000 + 60 * 60_000, // 1h après
    });
    expect(result).toEqual({ allowed: true, requiresReason: true });
  });

  it('autorise un Admin dans la fenêtre sans raison (même non auteur)', () => {
    const result = canEditDose({
      dose: target(),
      currentDeviceId: 'dev-admin',
      currentRole: 'admin',
      nowMs: 1_000_000 + 5 * 60_000,
    });
    expect(result).toEqual({ allowed: true, requiresReason: false });
  });

  it("refuse une prise déjà voidée — quel que soit le rôle ou l'auteur", () => {
    const voided = target({ status: 'voided' });
    expect(
      canEditDose({
        dose: voided,
        currentDeviceId: 'dev-author',
        currentRole: 'contributor',
        nowMs: 1_000_000,
      }),
    ).toEqual({ allowed: false, reason: 'voided' });
    expect(
      canEditDose({
        dose: voided,
        currentDeviceId: 'dev-admin',
        currentRole: 'admin',
        nowMs: 1_000_000 + 60 * 60_000,
      }),
    ).toEqual({ allowed: false, reason: 'voided' });
  });

  it('refuse une prise en pending_review (doit passer par la résolution)', () => {
    const flagged = target({ status: 'pending_review' });
    expect(
      canEditDose({
        dose: flagged,
        currentDeviceId: 'dev-author',
        currentRole: 'contributor',
        nowMs: 1_000_000,
      }),
    ).toEqual({ allowed: false, reason: 'pending_review' });
  });

  it('refuse strictement un restricted_contributor même auteur dans la fenêtre', () => {
    const result = canEditDose({
      dose: target(),
      currentDeviceId: 'dev-author',
      currentRole: 'restricted_contributor',
      nowMs: 1_000_000 + 5 * 60_000,
    });
    expect(result).toEqual({ allowed: false, reason: 'restricted_role' });
  });

  it('refuse un contributor auteur juste après la fenêtre (30 min + 1 ms)', () => {
    const result = canEditDose({
      dose: target(),
      currentDeviceId: 'dev-author',
      currentRole: 'contributor',
      nowMs: 1_000_000 + FREE_WINDOW_MS + 1,
    });
    expect(result).toEqual({ allowed: false, reason: 'not_author_and_too_old' });
  });

  it('est pure : deux appels avec mêmes inputs renvoient des résultats égaux', () => {
    const input = {
      dose: target(),
      currentDeviceId: 'dev-author',
      currentRole: 'contributor',
      nowMs: 1_000_000 + 10 * 60_000,
    } as const;
    expect(canEditDose(input)).toEqual(canEditDose(input));
  });
});
