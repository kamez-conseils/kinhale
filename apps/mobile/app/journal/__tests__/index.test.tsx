import React from 'react';
import { screen } from '@testing-library/react-native';
import JournalScreen from '../index';
import { renderWithProviders } from '../../../src/test-utils/render';
import type { KinhaleDoc } from '@kinhale/sync';
import type { DoseAdministeredPayload } from '@kinhale/sync';

jest.mock('@kinhale/crypto');
jest.mock('@kinhale/sync');

const makeDocWithDose = (
  overrides: Partial<DoseAdministeredPayload> = {},
): KinhaleDoc => {
  const payload: DoseAdministeredPayload = {
    doseId: 'dose-abc',
    pumpId: 'pump-1',
    childId: 'child-1',
    caregiverId: 'dev-1',
    administeredAtMs: 1_700_000_000_000,
    doseType: 'rescue',
    dosesAdministered: 1,
    symptoms: ['cough', 'wheezing'],
    circumstances: ['exercise'],
    freeFormTag: 'après sport',
    ...overrides,
  };
  return {
    householdId: 'hh-1',
    events: [
      {
        id: 'evt-1',
        type: 'DoseAdministered',
        payloadJson: JSON.stringify(payload),
        signerPublicKeyHex: 'a'.repeat(64),
        signatureHex: 'b'.repeat(128),
        deviceId: 'dev-1',
        occurredAtMs: payload.administeredAtMs,
      },
    ],
  };
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('../../../src/stores/auth-store', () => ({
  useAuthStore: jest.fn(
    (selector: (s: { accessToken: string | null; householdId: string | null }) => unknown) =>
      selector({ accessToken: 'tok-1', householdId: 'hh-1' }),
  ),
}));

jest.mock('../../../src/stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { doc: null; initDoc: jest.Mock }) => unknown) =>
    selector({ doc: null, initDoc: jest.fn() }),
  ),
}));

describe('JournalScreen', () => {
  it('affiche le titre Journal', () => {
    renderWithProviders(<JournalScreen />);
    expect(screen.getByText(/journal/i)).toBeTruthy();
  });

  it('affiche un message vide quand aucune dose', () => {
    renderWithProviders(<JournalScreen />);
    expect(screen.getByText(/aucune prise|no doses/i)).toBeTruthy();
  });

  it('affiche le bouton ajouter une prise', () => {
    renderWithProviders(<JournalScreen />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('affiche les doses quand doc contient des événements DoseAdministered', () => {
    const { useDocStore } = jest.requireMock('../../../src/stores/doc-store') as {
      useDocStore: jest.Mock;
    };
    const { projectDoses } = jest.requireMock('@kinhale/sync') as {
      projectDoses: jest.Mock;
    };
    const doc = makeDocWithDose({ doseType: 'maintenance' });
    useDocStore.mockImplementation(
      (selector: (s: { doc: KinhaleDoc | null; initDoc: jest.Mock }) => unknown) =>
        selector({ doc, initDoc: jest.fn() }),
    );
    projectDoses.mockReturnValue([
      {
        eventId: 'evt-1',
        doseId: 'dose-abc',
        pumpId: 'pump-1',
        childId: 'child-1',
        caregiverId: 'dev-1',
        administeredAtMs: 1_700_000_000_000,
        doseType: 'maintenance',
        dosesAdministered: 1,
        symptoms: [],
        circumstances: [],
        freeFormTag: null,
        occurredAtMs: 1_700_000_000_000,
        deviceId: 'dev-1',
      },
    ]);
    renderWithProviders(<JournalScreen />);
    expect(screen.getByText(/fond|controller/i)).toBeTruthy();
  });

  it('affiche le type de dose depuis la projection', () => {
    const { useDocStore } = jest.requireMock('../../../src/stores/doc-store') as {
      useDocStore: jest.Mock;
    };
    const { projectDoses } = jest.requireMock('@kinhale/sync') as {
      projectDoses: jest.Mock;
    };
    const doc = makeDocWithDose();
    useDocStore.mockImplementation(
      (selector: (s: { doc: KinhaleDoc | null; initDoc: jest.Mock }) => unknown) =>
        selector({ doc, initDoc: jest.fn() }),
    );
    projectDoses.mockReturnValue([
      {
        eventId: 'evt-1',
        doseId: 'dose-abc',
        pumpId: 'pump-1',
        childId: 'child-1',
        caregiverId: 'dev-1',
        administeredAtMs: 1_700_000_000_000,
        doseType: 'rescue',
        dosesAdministered: 1,
        symptoms: ['cough', 'wheezing'],
        circumstances: ['exercise'],
        freeFormTag: 'après sport',
        occurredAtMs: 1_700_000_000_000,
        deviceId: 'dev-1',
      },
    ]);

    renderWithProviders(<JournalScreen />);
    expect(screen.getByText(/secours/i)).toBeTruthy();
  });

  it('affiche les symptômes de la dose', () => {
    const { useDocStore } = jest.requireMock('../../../src/stores/doc-store') as {
      useDocStore: jest.Mock;
    };
    const { projectDoses } = jest.requireMock('@kinhale/sync') as {
      projectDoses: jest.Mock;
    };
    const doc = makeDocWithDose();
    useDocStore.mockImplementation(
      (selector: (s: { doc: KinhaleDoc | null; initDoc: jest.Mock }) => unknown) =>
        selector({ doc, initDoc: jest.fn() }),
    );
    projectDoses.mockReturnValue([
      {
        eventId: 'evt-1',
        doseId: 'dose-abc',
        pumpId: 'pump-1',
        childId: 'child-1',
        caregiverId: 'dev-1',
        administeredAtMs: 1_700_000_000_000,
        doseType: 'rescue',
        dosesAdministered: 1,
        symptoms: ['cough', 'wheezing'],
        circumstances: ['exercise'],
        freeFormTag: 'après sport',
        occurredAtMs: 1_700_000_000_000,
        deviceId: 'dev-1',
      },
    ]);

    renderWithProviders(<JournalScreen />);
    expect(screen.getByText(/toux/i)).toBeTruthy();
  });
});
