import React from 'react';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils/render';
import HomePage from './page';

// ──────────────────────────────────────────────────────────────────────────
// Mocks Next.js + auth + doc-store + sync.
//
// On stub @kinhale/sync entièrement : Jest ne sait pas résoudre les
// imports `./doc/lifecycle.js` du package compilé. Par défaut les
// projections retournent des collections vides — chaque test peut
// surcharger une projection pour exercer un chemin spécifique.
// ──────────────────────────────────────────────────────────────────────────

const replaceMock = jest.fn();
const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

let mockAccessToken: string | null = 'tok-fake';
let mockHouseholdId: string | null = 'hh-1';
let mockDeviceId: string | null = 'dev-1';

jest.mock('../stores/auth-store', () => ({
  useAuthStore: jest.fn(
    (
      selector: (s: {
        accessToken: string | null;
        householdId: string | null;
        deviceId: string | null;
      }) => unknown,
    ) =>
      selector({
        accessToken: mockAccessToken,
        householdId: mockHouseholdId,
        deviceId: mockDeviceId,
      }),
  ),
}));

const initDocMock = jest.fn().mockResolvedValue(undefined);
let mockDoc: { __sentinel: true } | null = null;

jest.mock('../stores/doc-store', () => ({
  useDocStore: jest.fn(
    (
      selector: (s: {
        doc: { __sentinel: true } | null;
        initDoc: (h: string) => Promise<void>;
      }) => unknown,
    ) => selector({ doc: mockDoc, initDoc: initDocMock }),
  ),
}));

const projectPumpsMock = jest.fn(() => [] as unknown[]);
const projectDosesMock = jest.fn(() => [] as unknown[]);
const projectCaregiversMock = jest.fn(() => [] as unknown[]);
const projectChildMock = jest.fn(() => null as { firstName?: string } | null);
const projectPlanMock = jest.fn(
  () => null as { scheduledHoursUtc: number[]; pumpId: string } | null,
);

jest.mock('@kinhale/sync', () => ({
  projectChild: () => projectChildMock(),
  projectPumps: () => projectPumpsMock(),
  projectDoses: () => projectDosesMock(),
  projectCaregivers: () => projectCaregiversMock(),
  projectPlan: () => projectPlanMock(),
}));

const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-fake';
    mockHouseholdId = 'hh-1';
    mockDeviceId = 'dev-1';
    mockDoc = null;
    projectPumpsMock.mockReturnValue([]);
    projectDosesMock.mockReturnValue([]);
    projectCaregiversMock.mockReturnValue([]);
    projectChildMock.mockReturnValue(null);
    projectPlanMock.mockReturnValue(null);
  });

  it("redirige vers /auth quand l'utilisateur n'est pas authentifié", async () => {
    mockAccessToken = null;
    mockHouseholdId = null;
    mockDeviceId = null;
    renderWithProviders(<HomePage />);
    await flush();
    expect(replaceMock).toHaveBeenCalledWith('/auth');
  });

  it('initialise le document Automerge avec le householdId courant', async () => {
    renderWithProviders(<HomePage />);
    await flush();
    expect(initDocMock).toHaveBeenCalledWith('hh-1');
  });

  it('redirige vers /onboarding/child quand le foyer est vide après init', async () => {
    // doc resté null → après initDoc résolu, isEmptyHousehold=true → redirect.
    renderWithProviders(<HomePage />);
    await flush();
    expect(replaceMock).toHaveBeenCalledWith('/onboarding/child');
  });

  it('rend le dashboard quand le foyer contient au moins une pompe', async () => {
    mockDoc = { __sentinel: true };
    projectPumpsMock.mockReturnValue([
      {
        pumpId: 'p1',
        name: 'Pompe 1',
        pumpType: 'maintenance',
        substance: 'sub-x',
        dose: '50 mcg',
        colorKey: 'blue',
        puffsPerDose: 1,
        prescriber: '',
        pharmacy: '',
        totalDoses: 200,
        dosesRemaining: 180,
        expiresAtMs: null,
      },
    ]);

    renderWithProviders(<HomePage />);
    await flush();

    // Le HomeDashboard rend le titre du programme du jour : signature
    // visuelle fiable que le composant est bien monté avec des données.
    expect(screen.getByText(/Programme du jour|Today's schedule/i)).toBeInTheDocument();
    // Disclaimer médical RM27 toujours présent.
    expect(
      screen.getByText(/remplace pas un avis médical|substitute for medical advice/i),
    ).toBeInTheDocument();
    // Pas de redirect onboarding puisque le foyer n'est plus vide.
    expect(replaceMock).not.toHaveBeenCalledWith('/onboarding/child');
  });
});

jest.setTimeout(15000);
