import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
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

describe('OnboardingPumpPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-1';
    mockAppendPump.mockResolvedValue([new Uint8Array([1])]);
  });

  it('affiche le formulaire', () => {
    renderWithProviders(<OnboardingPumpPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('redirige vers /auth si non authentifié (#181)', async () => {
    mockAccessToken = null;
    jest.useFakeTimers();
    try {
      renderWithProviders(<OnboardingPumpPage />);
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

  it('navigue vers /onboarding/plan après sauvegarde réussie', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<OnboardingPumpPage />);
      fireEvent.change(screen.getByPlaceholderText(/ventolin|ventolin/i), {
        target: { value: 'Ventolin' },
      });
      fireEvent.change(screen.getByPlaceholderText(/200/i), { target: { value: '200' } });
      fireEvent.click(screen.getByText(/enregistrer|save/i));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockAppendPump).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Ventolin', totalDoses: 200 }),
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
      renderWithProviders(<OnboardingPumpPage />);
      fireEvent.change(screen.getByPlaceholderText(/ventolin|ventolin/i), {
        target: { value: 'Ventolin' },
      });
      fireEvent.change(screen.getByPlaceholderText(/200/i), { target: { value: '200' } });
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
