import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import OnboardingPumpScreen from '../pump';
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

const mockAppendPump = jest.fn().mockResolvedValue([new Uint8Array([1])]);
jest.mock('../../../src/stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { appendPump: jest.Mock }) => unknown) =>
    selector({ appendPump: mockAppendPump }),
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

describe('OnboardingPumpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppendPump.mockResolvedValue([new Uint8Array([1])]);
  });

  it('navigue vers /onboarding/plan après sauvegarde réussie', async () => {
    renderWithProviders(<OnboardingPumpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/ventolin|inhaler/i), 'Ventolin');
    fireEvent.changeText(screen.getByPlaceholderText(/200/i), '200');
    fireEvent.press(screen.getByText(/enregistrer|save/i));
    await waitFor(() => {
      expect(mockAppendPump).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Ventolin', totalDoses: 200 }),
        'dev-1',
        expect.any(Uint8Array),
      );
    });
    expect(mockPush).toHaveBeenCalledWith('/onboarding/plan');
  });
});
