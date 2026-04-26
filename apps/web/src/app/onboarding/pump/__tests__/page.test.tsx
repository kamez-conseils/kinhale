import React from 'react';
import { screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingPumpPage from '../page';
import { renderWithProviders } from '../../../../test-utils/render';

jest.setTimeout(15000);

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

const mockAppendPump = jest.fn().mockResolvedValue([new Uint8Array([1])]);
jest.mock('../../../../stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { appendPump: jest.Mock }) => unknown) =>
    selector({ appendPump: mockAppendPump }),
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

describe('OnboardingPumpPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-1';
    mockConnected = true;
    mockAppendPump.mockResolvedValue([new Uint8Array([1])]);
  });

  it('affiche le titre du step Pumps', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<OnboardingPumpPage />);
      await flush();
      // KIN-108 : refonte clinical-calm — titre étape 2 « Quelles sont
      // ses pompes ? » / « What inhalers do they use? ».
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('redirige vers /auth si non authentifié (#181)', async () => {
    mockAccessToken = null;
    jest.useFakeTimers();
    try {
      renderWithProviders(<OnboardingPumpPage />);
      await flush();
      expect(mockReplace).toHaveBeenCalledWith('/auth');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('crée une pompe maintenance + une pompe rescue par défaut puis redirige', async () => {
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWithProviders(<OnboardingPumpPage />);
      await flush();
      // Les deux toggles sont actifs par défaut → un clic sur le CTA suffit.
      await user.click(screen.getByTestId('onboarding-pumps-cta'));
      await flush();
      expect(mockAppendPump).toHaveBeenCalledTimes(2);
      expect(mockAppendPump).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Fluticasone', pumpType: 'maintenance', totalDoses: 200 }),
        'dev-1',
        expect.any(Uint8Array),
      );
      expect(mockAppendPump).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Salbutamol', pumpType: 'rescue', totalDoses: 200 }),
        'dev-1',
        expect.any(Uint8Array),
      );
      expect(mockPush).toHaveBeenCalledWith('/onboarding/plan');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche une erreur si appendPump échoue', async () => {
    jest.useFakeTimers();
    try {
      mockAppendPump.mockRejectedValueOnce(new Error('network'));
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWithProviders(<OnboardingPumpPage />);
      await flush();
      await user.click(screen.getByTestId('onboarding-pumps-cta'));
      await flush();
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
