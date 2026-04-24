import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import OnboardingPlanScreen from '../plan';
import { renderWithProviders } from '../../../src/test-utils/render';

jest.mock('@kinhale/sync', () => ({
  projectPumps: jest.fn(() => [
    {
      pumpId: 'pump-1',
      name: 'Ventolin',
      pumpType: 'maintenance',
      totalDoses: 200,
      expiresAtMs: null,
    },
  ]),
}));

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

const mockAppendPlan = jest.fn().mockResolvedValue([new Uint8Array([1])]);
const mockDoc = {
  householdId: 'hh-1',
  events: [
    {
      id: 'e1',
      type: 'PumpReplaced',
      payloadJson: JSON.stringify({
        pumpId: 'pump-1',
        name: 'Ventolin',
        pumpType: 'maintenance',
        totalDoses: 200,
        expiresAtMs: null,
      }),
      signerPublicKeyHex: 'a'.repeat(64),
      signatureHex: 'b'.repeat(128),
      deviceId: 'dev-1',
      occurredAtMs: 1000,
    },
  ],
};
jest.mock('../../../src/stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { appendPlan: jest.Mock; doc: typeof mockDoc }) => unknown) =>
    selector({ appendPlan: mockAppendPlan, doc: mockDoc }),
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

// Par défaut : en ligne, pour que les tests existants ne butent pas sur le
// guard E7-S08. Un test dédié couvrira la branche hors-ligne plus tard.
jest.mock('../../../src/stores/sync-status-store', () => ({
  useSyncStatusStore: jest.fn(
    (selector: (s: { connected: boolean; pulling: boolean }) => unknown) =>
      selector({ connected: true, pulling: false }),
  ),
}));

describe('OnboardingPlanScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppendPlan.mockResolvedValue([new Uint8Array([1])]);
  });

  it('affiche la pompe de fond disponible', () => {
    renderWithProviders(<OnboardingPlanScreen />);
    expect(screen.getByText(/ventolin/i)).toBeTruthy();
  });

  it('navigue vers /journal après sauvegarde réussie', async () => {
    renderWithProviders(<OnboardingPlanScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/8.*20|ex.*8/i), '8, 20');
    fireEvent.press(screen.getByText(/enregistrer|save/i));
    await waitFor(() => {
      expect(mockAppendPlan).toHaveBeenCalledWith(
        expect.objectContaining({ pumpId: 'pump-1', scheduledHoursUtc: [8, 20] }),
        'dev-1',
        expect.any(Uint8Array),
      );
    });
    expect(mockPush).toHaveBeenCalledWith('/journal');
  });
});
