import { describe, expect, it } from 'vitest';
import type { Caregiver } from '../entities/caregiver';
import type { Dose } from '../entities/dose';
import type { Household } from '../entities/household';
import type { Role } from '../entities/role';
import { planPeerNotification } from './rm5-peer-notification';

const ADMINISTERED = new Date('2026-04-19T08:00:00Z');
const SERVER_RECEIVED = new Date('2026-04-19T08:00:03Z');

function makeCaregiver(overrides: Partial<Caregiver> & { id: string; role: Role }): Caregiver {
  return {
    householdId: 'h1',
    status: 'active',
    displayName: overrides.id,
    invitedAt: new Date('2026-01-01T00:00:00Z'),
    activatedAt: new Date('2026-01-01T12:00:00Z'),
    revokedAt: null,
    ...overrides,
  };
}

function makeHousehold(caregivers: ReadonlyArray<Caregiver>): Household {
  return {
    id: 'h1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    timezone: 'America/Toronto',
    locale: 'fr',
    caregivers,
  };
}

function makeDose(overrides: Partial<Dose> & { id: string; caregiverId: string }): Dose {
  return {
    householdId: 'h1',
    childId: 'c1',
    pumpId: 'p1',
    type: 'maintenance',
    status: 'confirmed',
    source: 'manual',
    dosesAdministered: 1,
    administeredAtUtc: ADMINISTERED,
    recordedAtUtc: SERVER_RECEIVED,
    symptoms: [],
    circumstances: [],
    freeFormTag: null,
    voidedReason: null,
    ...overrides,
  };
}

describe('RM5 — planPeerNotification (cas nominal)', () => {
  it('auteur admin + 2 contributors actifs : 2 destinataires, auteur exclu', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
      makeCaregiver({ id: 'contrib-2', role: 'contributor' }),
    ]);
    const dose = makeDose({ id: 'd1', caregiverId: 'admin-1' });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    expect(event).not.toBeNull();
    expect(event?.kind).toBe('peer_dose_recorded');
    expect(event?.doseId).toBe('d1');
    expect(event?.pumpId).toBe('p1');
    expect(event?.doseType).toBe('maintenance');
    expect(event?.authorCaregiverId).toBe('admin-1');
    expect(event?.recipients.map((r) => r.caregiverId).sort()).toEqual(['contrib-1', 'contrib-2']);
  });

  it('auteur contributor : admin + autre contributor reçoivent', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
      makeCaregiver({ id: 'contrib-2', role: 'contributor' }),
    ]);
    const dose = makeDose({ id: 'd1', caregiverId: 'contrib-1' });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    expect(event?.recipients.map((r) => r.caregiverId).sort()).toEqual(['admin-1', 'contrib-2']);
  });

  it('dose rescue : kind=peer_dose_recorded, doseType=rescue', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
    ]);
    const dose = makeDose({
      id: 'd1',
      caregiverId: 'admin-1',
      type: 'rescue',
      symptoms: ['cough'],
    });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    expect(event?.doseType).toBe('rescue');
  });
});

describe('RM5 — planPeerNotification (exclusions)', () => {
  it('exclut les aidants invited (non actifs)', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
      makeCaregiver({ id: 'invited-1', role: 'contributor', status: 'invited', activatedAt: null }),
    ]);
    const dose = makeDose({ id: 'd1', caregiverId: 'admin-1' });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    expect(event?.recipients.map((r) => r.caregiverId)).toEqual(['contrib-1']);
  });

  it('exclut les aidants revoked', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
      makeCaregiver({
        id: 'revoked-1',
        role: 'contributor',
        status: 'revoked',
        revokedAt: new Date('2026-03-01T00:00:00Z'),
      }),
    ]);
    const dose = makeDose({ id: 'd1', caregiverId: 'admin-1' });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    expect(event?.recipients.map((r) => r.caregiverId)).toEqual(['contrib-1']);
  });

  it('exclut les restricted_contributor (SPECS ligne 450)', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
      makeCaregiver({ id: 'nanny-1', role: 'restricted_contributor' }),
    ]);
    const dose = makeDose({ id: 'd1', caregiverId: 'admin-1' });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    expect(event?.recipients.map((r) => r.caregiverId)).toEqual(['contrib-1']);
  });

  it("auteur = restricted_contributor : les autres actifs non-restricted reçoivent l'info", () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
      makeCaregiver({ id: 'nanny-1', role: 'restricted_contributor' }),
    ]);
    const dose = makeDose({ id: 'd1', caregiverId: 'nanny-1' });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    expect(event?.authorCaregiverId).toBe('nanny-1');
    expect(event?.recipients.map((r) => r.caregiverId).sort()).toEqual(['admin-1', 'contrib-1']);
  });

  it("foyer solo (seul l'auteur actif) : null", () => {
    const household = makeHousehold([makeCaregiver({ id: 'admin-1', role: 'admin' })]);
    const dose = makeDose({ id: 'd1', caregiverId: 'admin-1' });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    expect(event).toBeNull();
  });

  it('aucun destinataire après filtrage (tous restricted ou inactifs) : null', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'nanny-1', role: 'restricted_contributor' }),
      makeCaregiver({
        id: 'invited-1',
        role: 'contributor',
        status: 'invited',
        activatedAt: null,
      }),
    ]);
    const dose = makeDose({ id: 'd1', caregiverId: 'admin-1' });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    expect(event).toBeNull();
  });
});

describe('RM5 — planPeerNotification (statut de la dose)', () => {
  it('dose voided : null (pas de notification peer sur void)', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
    ]);
    const dose = makeDose({
      id: 'd1',
      caregiverId: 'admin-1',
      status: 'voided',
      voidedReason: 'erreur',
    });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    expect(event).toBeNull();
  });

  it('dose pending_review : null (flux dispute_detected, pas RM5)', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
    ]);
    const dose = makeDose({ id: 'd1', caregiverId: 'admin-1', status: 'pending_review' });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    expect(event).toBeNull();
  });
});

describe('RM5 — planPeerNotification (syncOffsetMs)', () => {
  it('décalage < 5 min : champ absent (pas de mention « synchronisée à »)', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
    ]);
    // 3 s d'écart client/serveur (saisie en ligne normale).
    const dose = makeDose({ id: 'd1', caregiverId: 'admin-1' });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    expect(event?.syncOffsetMs).toBeUndefined();
  });

  it('décalage = 5 min pile (borne inclusive) : champ absent', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
    ]);
    const administered = new Date('2026-04-19T08:00:00Z');
    const received = new Date('2026-04-19T08:05:00Z'); // +5 min pile
    const dose = makeDose({
      id: 'd1',
      caregiverId: 'admin-1',
      administeredAtUtc: administered,
      recordedAtUtc: received,
    });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: received,
    });
    expect(event?.syncOffsetMs).toBeUndefined();
  });

  it('décalage > 5 min : champ présent en ms (déclenche mention synchronisée)', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
    ]);
    const administered = new Date('2026-04-19T08:00:00Z');
    const received = new Date('2026-04-19T08:12:34Z'); // +12 min 34 s
    const dose = makeDose({
      id: 'd1',
      caregiverId: 'admin-1',
      administeredAtUtc: administered,
      recordedAtUtc: received,
    });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: received,
    });
    expect(event?.syncOffsetMs).toBe(12 * 60_000 + 34_000);
  });

  it('décalage négatif (horloge client en avance) : champ absent', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
    ]);
    const administered = new Date('2026-04-19T08:05:00Z');
    const received = new Date('2026-04-19T08:00:00Z');
    const dose = makeDose({
      id: 'd1',
      caregiverId: 'admin-1',
      administeredAtUtc: administered,
      recordedAtUtc: received,
    });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: received,
    });
    expect(event?.syncOffsetMs).toBeUndefined();
  });
});

describe('RM5 — planPeerNotification (défensif / pureté)', () => {
  it('auteur absent du foyer : null (défensif, pas de lever)', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
    ]);
    const dose = makeDose({ id: 'd1', caregiverId: 'ghost-99' });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    // Aucun matching caregiverId : tous les aidants actifs non-restricted
    // deviennent destinataires car l'auteur « n'existe » pas côté foyer.
    // Choix défensif : on n'exclut rien et on laisse émettre l'event.
    expect(event).not.toBeNull();
    expect(event?.recipients.map((r) => r.caregiverId).sort()).toEqual(['admin-1', 'contrib-1']);
  });

  it('ne mute pas le household ni la dose', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
    ]);
    const originalCaregivers = household.caregivers;
    const dose = makeDose({ id: 'd1', caregiverId: 'admin-1' });
    planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    expect(household.caregivers).toBe(originalCaregivers);
    expect(dose.status).toBe('confirmed');
  });

  it('recipients exposent le rôle de l aidant', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin-1', role: 'admin' }),
      makeCaregiver({ id: 'contrib-1', role: 'contributor' }),
      makeCaregiver({ id: 'contrib-2', role: 'contributor' }),
    ]);
    const dose = makeDose({ id: 'd1', caregiverId: 'contrib-1' });
    const event = planPeerNotification({
      household,
      dose,
      serverReceivedAtUtc: SERVER_RECEIVED,
    });
    const byId = new Map(event?.recipients.map((r) => [r.caregiverId, r.role]));
    expect(byId.get('admin-1')).toBe('admin');
    expect(byId.get('contrib-2')).toBe('contributor');
  });
});
