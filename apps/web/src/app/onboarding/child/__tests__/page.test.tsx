import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import OnboardingChildPage from '../page';
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

const mockAppendChild = jest.fn().mockResolvedValue([new Uint8Array([1])]);
jest.mock('../../../../stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { appendChild: jest.Mock }) => unknown) =>
    selector({ appendChild: mockAppendChild }),
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

// Statut sync — mutable pour que les tests du guard E7-S08 puissent le
// basculer. Par défaut : en ligne.
let mockConnected = true;
jest.mock('../../../../stores/sync-status-store', () => ({
  useSyncStatusStore: jest.fn(
    (selector: (s: { connected: boolean; pulling: boolean }) => unknown) =>
      selector({ connected: mockConnected, pulling: false }),
  ),
}));

describe('OnboardingChildPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-1';
    mockConnected = true;
    mockAppendChild.mockResolvedValue([new Uint8Array([1])]);
  });

  it('affiche le formulaire', () => {
    renderWithProviders(<OnboardingChildPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it("affiche le DisclaimerBanner complet (RM27, KIN-088) sur l'écran 1", () => {
    renderWithProviders(<OnboardingChildPage />);
    // Onboarding écran 1 → version complète + footer discret en pied.
    expect(screen.getByTestId('disclaimer-banner-full')).toBeTruthy();
    expect(screen.getByTestId('disclaimer-footer-short')).toBeTruthy();
  });

  it('redirige vers /auth si non authentifié (#181)', async () => {
    mockAccessToken = null;
    jest.useFakeTimers();
    try {
      renderWithProviders(<OnboardingChildPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockReplace).toHaveBeenCalledWith('/auth');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('navigue vers /onboarding/pump après sauvegarde réussie', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<OnboardingChildPage />);
      // KIN-107 : placeholder devient "Léa"/"Lea", bouton devient
      // "Continuer"/"Continue" — refonte clinical-calm.
      fireEvent.change(screen.getByPlaceholderText(/Léa|Lea/i), {
        target: { value: 'Emma' },
      });
      fireEvent.change(screen.getByPlaceholderText(/2020/i), { target: { value: '2020' } });
      fireEvent.click(screen.getByText(/^Continuer$|^Continue$/i));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockAppendChild).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Emma', birthYear: 2020 }),
        'dev-1',
        expect.any(Uint8Array),
      );
      expect(mockPush).toHaveBeenCalledWith('/onboarding/pump');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche une erreur si appendChild échoue', async () => {
    jest.useFakeTimers();
    try {
      mockAppendChild.mockRejectedValueOnce(new Error('network error'));
      renderWithProviders(<OnboardingChildPage />);
      fireEvent.change(screen.getByPlaceholderText(/Léa|Lea/i), {
        target: { value: 'Emma' },
      });
      fireEvent.change(screen.getByPlaceholderText(/2020/i), { target: { value: '2020' } });
      fireEvent.click(screen.getByText(/^Continuer$|^Continue$/i));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('hors-ligne : affiche le message du guard et ne déclenche pas appendChild', async () => {
    jest.useFakeTimers();
    try {
      mockConnected = false;
      renderWithProviders(<OnboardingChildPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByTestId('offline-guard-message')).toBeTruthy();

      // Même si l'utilisateur clique malgré le disabled : le handler
      // `if (!online) return` doit empêcher appendChild d'être appelé.
      const input = screen.getByPlaceholderText(/Léa|Lea/i);
      fireEvent.change(input, { target: { value: 'Emma' } });
      const yearInput = screen.getByPlaceholderText(/2020|year/i);
      fireEvent.change(yearInput, { target: { value: '2020' } });
      fireEvent.click(screen.getByText(/^Continuer$|^Continue$/i));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockAppendChild).not.toHaveBeenCalled();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
