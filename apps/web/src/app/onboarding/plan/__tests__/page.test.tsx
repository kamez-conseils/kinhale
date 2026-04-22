import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import OnboardingPlanPage from '../page';
import { renderWithProviders } from '../../../../test-utils/render';

jest.setTimeout(15000);

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
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../../../stores/auth-store', () => ({
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

describe('OnboardingPlanPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppendPlan.mockResolvedValue([new Uint8Array([1])]);
  });

  it('affiche la pompe de fond disponible', () => {
    renderWithProviders(<OnboardingPlanPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/ventolin/i)).toBeInTheDocument();
  });

  it('navigue vers /journal après sauvegarde réussie', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<OnboardingPlanPage />);
      fireEvent.change(screen.getByPlaceholderText(/8.*20|ex.*8/i), {
        target: { value: '8, 20' },
      });
      fireEvent.click(screen.getByText(/enregistrer|save/i));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockAppendPlan).toHaveBeenCalledWith(
        expect.objectContaining({ pumpId: 'pump-1', scheduledHoursUtc: [8, 20] }),
        'dev-1',
        expect.any(Uint8Array),
      );
      expect(mockPush).toHaveBeenCalledWith('/journal');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
