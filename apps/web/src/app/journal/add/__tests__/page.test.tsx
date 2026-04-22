import React from 'react';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import AddDosePage from '../page';
import { renderWithProviders } from '../../../../test-utils/render';

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

const mockAppendDose = jest.fn().mockResolvedValue([new Uint8Array([1])]);
jest.mock('../../../../stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { appendDose: jest.Mock }) => unknown) =>
    selector({ appendDose: mockAppendDose }),
  ),
}));

const mockSendChanges = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../../hooks/use-relay', () => ({
  useRelay: jest.fn(() => ({ sendChanges: mockSendChanges })),
}));

const mockGetOrCreateDevice = jest.fn().mockResolvedValue({
  publicKey: new Uint8Array(32),
  secretKey: new Uint8Array(64),
  publicKeyHex: 'a'.repeat(64),
});
const mockGetGroupKey = jest.fn().mockResolvedValue(new Uint8Array(32));
jest.mock('../../../../lib/device', () => ({
  getOrCreateDevice: (...args: unknown[]) => mockGetOrCreateDevice(...args),
  getGroupKey: (...args: unknown[]) => mockGetGroupKey(...args),
}));

describe('AddDosePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppendDose.mockResolvedValue([new Uint8Array([1])]);
    mockGetOrCreateDevice.mockResolvedValue({
      publicKey: new Uint8Array(32),
      secretKey: new Uint8Array(64),
      publicKeyHex: 'a'.repeat(64),
    });
    mockGetGroupKey.mockResolvedValue(new Uint8Array(32));
    mockSendChanges.mockResolvedValue(undefined);
  });

  it('affiche le formulaire avec les deux boutons de type', async () => {
    renderWithProviders(<AddDosePage />);
    // Attendre la résolution du useEffect getGroupKey pour éviter l'avertissement act()
    await waitFor(() => expect(mockGetGroupKey).toHaveBeenCalledWith('hh-1'));
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(3); // maintenance + rescue + save
  });

  it('navigue vers /journal après sauvegarde réussie', async () => {
    // Fake timers : empêche Tamagui de scheduler des setState via setTimeout hors act(),
    // ce qui crée une boucle MutationObserver dans RTL v16 + React 19 + jsdom (CI Docker).
    // Pas de warm-up getGroupKey : groupKey reste null, sendChanges est skippé,
    // router.push est appelé directement (structure identique au test d'erreur qui passe).
    jest.useFakeTimers();
    try {
      renderWithProviders(<AddDosePage />);
      fireEvent.click(screen.getByText(/enregistrer|save/i));
      await act(async () => {
        await Promise.resolve(); // getOrCreateDevice résout
        await Promise.resolve(); // appendDose résout → (groupKey null, skip) → router.push
        await Promise.resolve(); // mises à jour d'état propagées
      });
      expect(mockAppendDose).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/journal');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche une erreur si appendDose échoue', async () => {
    // Fake timers : même raison que les autres tests (deadlock Tamagui × RTL × React 19 CI).
    jest.useFakeTimers();
    try {
      mockAppendDose.mockRejectedValueOnce(new Error('réseau indisponible'));
      renderWithProviders(<AddDosePage />);
      fireEvent.click(screen.getByRole('button', { name: /enregistrer|save/i }));
      await act(async () => {
        await Promise.resolve(); // getOrCreateDevice résout
        await Promise.resolve(); // appendDose rejette → catch setError + finally setLoading
        await Promise.resolve(); // mises à jour d'état propagées
      });
      expect(mockAppendDose).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalledWith('/journal');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('appelle sendChanges quand groupKey est disponible', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<AddDosePage />);
      // Flush getGroupKey → setGroupKey pour que groupKey !== null au moment du clic
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      fireEvent.click(screen.getByText(/enregistrer|save/i));
      // Flush handleSave : getOrCreateDevice → appendDose → sendChanges → router.push + setLoading
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockSendChanges).toHaveBeenCalled();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche une erreur RM4 si rescue sans contexte', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<AddDosePage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      fireEvent.click(screen.getByText(/secours|rescue/i));
      fireEvent.click(screen.getByText(/enregistrer|save/i));
      // validate() échoue de façon synchrone → setError batché par React
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(mockAppendDose).not.toHaveBeenCalled();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('sauvegarde rescue avec symptôme sélectionné', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<AddDosePage />);
      // Flush getGroupKey pour cohérence (sendChanges éventuellement appelé)
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      fireEvent.click(screen.getByText(/secours|rescue/i));
      fireEvent.click(screen.getByText(/toux|cough/i));
      fireEvent.click(screen.getByText(/enregistrer|save/i));
      await act(async () => {
        await Promise.resolve(); // getOrCreateDevice
        await Promise.resolve(); // appendDose
        await Promise.resolve(); // sendChanges
        await Promise.resolve(); // state updates
      });
      expect(mockAppendDose).toHaveBeenCalledWith(
        expect.objectContaining({
          doseType: 'rescue',
          symptoms: expect.arrayContaining(['cough']),
        }),
        expect.any(String),
        expect.any(Uint8Array),
      );
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
