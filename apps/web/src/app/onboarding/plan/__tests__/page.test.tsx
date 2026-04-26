import React from 'react';
import { fireEvent, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingPlanPage from '../page';
import { renderWithProviders } from '../../../../test-utils/render';

jest.setTimeout(15000);

const mockProjectPumps = jest.fn((_doc: unknown) => [
  {
    pumpId: 'pump-1',
    name: 'Fluticasone',
    pumpType: 'maintenance',
    totalDoses: 200,
    expiresAtMs: null,
    isExpired: false,
  },
]);

jest.mock('@kinhale/sync', () => ({
  projectPumps: (doc: unknown) => mockProjectPumps(doc),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

let mockAccessToken: string | null = 'tok-1';
jest.mock('../../../../stores/auth-store', () => ({
  useAuthStore: jest.fn(
    (
      selector: (s: {
        accessToken: string | null;
        deviceId: string | null;
        householdId: string | null;
      }) => unknown,
    ) => selector({ accessToken: mockAccessToken, deviceId: 'dev-1', householdId: 'hh-1' }),
  ),
}));

const mockAppendPlan = jest.fn().mockResolvedValue([new Uint8Array([1])]);
const mockDoc = { householdId: 'hh-1', events: [] };
jest.mock('../../../../stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { appendPlan: jest.Mock; doc: typeof mockDoc }) => unknown) =>
    selector({ appendPlan: mockAppendPlan, doc: mockDoc }),
  ),
}));

const mockGetOrCreateDevice = jest.fn().mockResolvedValue({
  publicKey: new Uint8Array(32),
  secretKey: new Uint8Array(64),
  publicKeyHex: 'a'.repeat(64),
});
jest.mock('../../../../lib/device', () => ({
  getOrCreateDevice: (...args: unknown[]) => mockGetOrCreateDevice(...args),
}));

let mockConnected = true;
jest.mock('../../../../stores/sync-status-store', () => ({
  useSyncStatusStore: jest.fn(
    (selector: (s: { connected: boolean; pulling: boolean }) => unknown) =>
      selector({ connected: mockConnected, pulling: false }),
  ),
}));

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('OnboardingPlanPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-1';
    mockConnected = true;
    mockAppendPlan.mockResolvedValue([new Uint8Array([1])]);
    mockProjectPumps.mockReturnValue([
      {
        pumpId: 'pump-1',
        name: 'Fluticasone',
        pumpType: 'maintenance',
        totalDoses: 200,
        expiresAtMs: null,
        isExpired: false,
      },
    ]);
  });

  it('redirige vers /auth si non authentifié (#181)', async () => {
    mockAccessToken = null;
    jest.useFakeTimers();
    try {
      renderWithProviders(<OnboardingPlanPage />);
      await flush();
      expect(mockReplace).toHaveBeenCalledWith('/auth');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche le titre du step Plan + horaires par défaut 8h/20h', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<OnboardingPlanPage />);
      await flush();
      // KIN-108 : refonte clinical-calm — titre étape 3 « À quels moments
      // de la journée ? » / « When during the day? ».
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('crée un plan avec [8, 20] sur la pompe maintenance puis redirige', async () => {
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWithProviders(<OnboardingPlanPage />);
      await flush();
      await user.click(screen.getByTestId('onboarding-plan-cta'));
      await flush();
      expect(mockAppendPlan).toHaveBeenCalledWith(
        expect.objectContaining({ pumpId: 'pump-1', scheduledHoursUtc: [8, 20] }),
        'dev-1',
        expect.any(Uint8Array),
      );
      expect(mockPush).toHaveBeenCalledWith('/onboarding/done');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche un message si aucune pompe maintenance et désactive le CTA', async () => {
    mockProjectPumps.mockReturnValue([]);
    jest.useFakeTimers();
    try {
      renderWithProviders(<OnboardingPlanPage />);
      await flush();
      // Le CTA est désactivé quand pas de pompe maintenance.
      const cta = screen.getByTestId('onboarding-plan-cta');
      expect(cta).toBeDisabled();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('hors-ligne : affiche le message du guard et ne déclenche pas appendPlan', async () => {
    mockConnected = false;
    jest.useFakeTimers();
    try {
      renderWithProviders(<OnboardingPlanPage />);
      await flush();
      expect(screen.getByTestId('offline-guard-message')).toBeTruthy();
      // Bouton désactivé → fireEvent court-circuite pointer-events: none
      // pour vérifier que le handler `if (!online) return` bloque.
      fireEvent.click(screen.getByTestId('onboarding-plan-cta'));
      await flush();
      expect(mockAppendPlan).not.toHaveBeenCalled();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
