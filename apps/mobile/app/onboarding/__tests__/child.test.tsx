import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import OnboardingChildScreen from '../child';
import { renderWithProviders } from '../../../src/test-utils/render';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../../src/stores/auth-store', () => ({
  useAuthStore: jest.fn(
    (
      selector: (s: {
        accessToken: string | null;
        deviceId: string | null;
        householdId: string | null;
      }) => unknown,
    ) => selector({ accessToken: 'tok-1', deviceId: 'dev-1', householdId: 'hh-1' }),
  ),
}));

const mockAppendChild = jest.fn().mockResolvedValue([new Uint8Array([1])]);
jest.mock('../../../src/stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { appendChild: jest.Mock }) => unknown) =>
    selector({ appendChild: mockAppendChild }),
  ),
}));

const mockGetOrCreateDevice = jest.fn().mockResolvedValue({
  publicKey: new Uint8Array(32),
  secretKey: new Uint8Array(64),
  publicKeyHex: 'a'.repeat(64),
});
jest.mock('../../../src/lib/device', () => ({
  getOrCreateDevice: (...args: unknown[]) => mockGetOrCreateDevice(...args),
}));

describe('OnboardingChildScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppendChild.mockResolvedValue([new Uint8Array([1])]);
  });

  it('affiche le formulaire', () => {
    renderWithProviders(<OnboardingChildScreen />);
    expect(screen.getAllByRole('header').length).toBeGreaterThanOrEqual(1);
  });

  it('navigue vers /onboarding/pump après sauvegarde réussie', async () => {
    renderWithProviders(<OnboardingChildScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/prénom|first name/i), 'Emma');
    fireEvent.changeText(screen.getByPlaceholderText(/2020/i), '2020');
    fireEvent.press(screen.getByText(/enregistrer|save/i));
    await waitFor(() => {
      expect(mockAppendChild).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Emma', birthYear: 2020 }),
        'dev-1',
        expect.any(Uint8Array),
      );
    });
    expect(mockPush).toHaveBeenCalledWith('/onboarding/pump');
  });

  it('affiche une erreur si appendChild échoue', async () => {
    mockAppendChild.mockRejectedValueOnce(new Error('network'));
    renderWithProviders(<OnboardingChildScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/prénom|first name/i), 'Emma');
    fireEvent.changeText(screen.getByPlaceholderText(/2020/i), '2020');
    fireEvent.press(screen.getByText(/enregistrer|save/i));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
