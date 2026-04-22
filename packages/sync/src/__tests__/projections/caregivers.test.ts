import { describe, it, expect } from 'vitest';
import type { KinhaleDoc, SignedEventRecord } from '../../doc/schema.js';
import { projectCaregivers } from '../../projections/caregivers.js';

const record = (type: string, payload: object, occurredAtMs: number): SignedEventRecord => ({
  id: `${type}-${occurredAtMs}`,
  type,
  payloadJson: JSON.stringify(payload),
  signerPublicKeyHex: 'aa',
  signatureHex: 'bb',
  deviceId: 'dev-1',
  occurredAtMs,
});

describe('projectCaregivers', () => {
  it('retourne un tableau vide si aucun événement Caregiver*', () => {
    const doc: KinhaleDoc = { householdId: 'h1', events: [] };
    expect(projectCaregivers(doc)).toEqual([]);
  });

  it('liste les aidants invités en statut "invited"', () => {
    const doc: KinhaleDoc = {
      householdId: 'h1',
      events: [
        record(
          'CaregiverInvited',
          { caregiverId: 'c1', role: 'contributor', displayName: 'Maman' },
          1,
        ),
      ],
    };
    const caregivers = projectCaregivers(doc);
    expect(caregivers).toHaveLength(1);
    expect(caregivers[0]).toMatchObject({
      caregiverId: 'c1',
      role: 'contributor',
      displayName: 'Maman',
      status: 'invited',
      acceptedAtMs: null,
    });
  });

  it('passe au statut "active" après CaregiverAccepted', () => {
    const doc: KinhaleDoc = {
      householdId: 'h1',
      events: [
        record(
          'CaregiverInvited',
          { caregiverId: 'c1', role: 'contributor', displayName: 'Maman' },
          1,
        ),
        record(
          'CaregiverAccepted',
          { caregiverId: 'c1', invitationId: 'inv1', acceptedAtMs: 2, deviceId: 'dev-1' },
          2,
        ),
      ],
    };
    const caregivers = projectCaregivers(doc);
    expect(caregivers[0]).toMatchObject({ status: 'active', acceptedAtMs: 2 });
  });

  it('exclut les aidants révoqués', () => {
    const doc: KinhaleDoc = {
      householdId: 'h1',
      events: [
        record(
          'CaregiverInvited',
          { caregiverId: 'c1', role: 'contributor', displayName: 'Maman' },
          1,
        ),
        record('CaregiverRevoked', { caregiverId: 'c1' }, 5),
      ],
    };
    expect(projectCaregivers(doc)).toEqual([]);
  });

  it('ignore silencieusement les payloads JSON invalides', () => {
    const doc: KinhaleDoc = {
      householdId: 'h1',
      events: [
        {
          id: 'x',
          type: 'CaregiverInvited',
          payloadJson: '{invalid json',
          signerPublicKeyHex: 'aa',
          signatureHex: 'bb',
          deviceId: 'd',
          occurredAtMs: 1,
        },
      ],
    };
    expect(projectCaregivers(doc)).toEqual([]);
  });
});
