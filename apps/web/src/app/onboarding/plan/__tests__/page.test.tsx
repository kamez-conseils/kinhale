import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import OnboardingPlanPage from '../page';
import { renderWithProviders } from '../../../../test-utils/render';

jest.setTimeout(15000);

const mockProjectPumps = jest.fn((_doc: unknown) => [
  {
    pumpId: 'pump-1',
    name: 'Ventolin',
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
    mockProjectPumps.mockReturnValue([
      {
        pumpId: 'pump-1',
        name: 'Ventolin',
        pumpType: 'maintenance',
        totalDoses: 200,
        expiresAtMs: null,
        isExpired: false,
      },
    ]);
  });

  it('affiche le formulaire quand une pompe de fond est disponible', () => {
    renderWithProviders(<OnboardingPlanPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    // Avec une seule pompe, le sélecteur est masqué (auto-sélection) et le champ heures est affiché
    expect(screen.getByPlaceholderText(/8.*20|ex.*8/i)).toBeInTheDocument();
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

  it('affiche le CTA "Ajouter une pompe" quand aucune pompe de fond n\'est enregistrée', async () => {
    mockProjectPumps.mockReturnValue([]);
    renderWithProviders(<OnboardingPlanPage />);
    expect(
      screen.getByText(/ajoute d'abord une pompe|add a maintenance pump/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/ajouter une pompe|add a pump/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/8.*20|ex.*8/i)).toBeNull();
  });

  it('navigue vers /onboarding/pump en cliquant sur le CTA quand aucune pompe', async () => {
    mockProjectPumps.mockReturnValue([]);
    jest.useFakeTimers();
    try {
      renderWithProviders(<OnboardingPlanPage />);
      fireEvent.click(screen.getByText(/ajouter une pompe|add a pump/i));
      expect(mockPush).toHaveBeenCalledWith('/onboarding/pump');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
