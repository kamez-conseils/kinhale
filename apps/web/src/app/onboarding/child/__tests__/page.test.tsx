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

// Par défaut : en ligne, pour que les tests existants ne butent pas sur le
// guard E7-S08 (disabled quand hors-ligne). Un test dédié vérifie le guard.
jest.mock('../../../../stores/sync-status-store', () => ({
  useSyncStatusStore: jest.fn(
    (selector: (s: { connected: boolean; pulling: boolean }) => unknown) =>
      selector({ connected: true, pulling: false }),
  ),
}));

describe('OnboardingChildPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-1';
    mockAppendChild.mockResolvedValue([new Uint8Array([1])]);
  });

  it('affiche le formulaire', () => {
    renderWithProviders(<OnboardingChildPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
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
      fireEvent.change(screen.getByPlaceholderText(/prénom|first name/i), {
        target: { value: 'Emma' },
      });
      fireEvent.change(screen.getByPlaceholderText(/2020/i), { target: { value: '2020' } });
      fireEvent.click(screen.getByText(/enregistrer|save/i));
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
      fireEvent.change(screen.getByPlaceholderText(/prénom|first name/i), {
        target: { value: 'Emma' },
      });
      fireEvent.change(screen.getByPlaceholderText(/2020/i), { target: { value: '2020' } });
      fireEvent.click(screen.getByText(/enregistrer|save/i));
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
});
