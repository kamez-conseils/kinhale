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
    // groupKey n'est pas nécessaire : router.push est appelé même si groupKey=null
    renderWithProviders(<AddDosePage />);
    fireEvent.click(screen.getByRole('button', { name: /enregistrer|save/i }));
    await waitFor(() => {
      expect(mockAppendDose).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/journal');
    });
  });

  it('affiche une erreur si appendDose échoue', async () => {
    mockAppendDose.mockRejectedValueOnce(new Error('réseau indisponible'));
    renderWithProviders(<AddDosePage />);
    fireEvent.click(screen.getByRole('button', { name: /enregistrer|save/i }));
    // Flush: getOrCreateDevice → appendDose rejection → catch setError → setLoading
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalledWith('/journal');
  });

  it('appelle sendChanges quand groupKey est disponible', async () => {
    renderWithProviders(<AddDosePage />);
    await waitFor(() => expect(mockGetGroupKey).toHaveBeenCalled());
    // Flush la résolution de la Promise (setGroupKey) via deux ticks de microtasks
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByText(/enregistrer|save/i));
    await waitFor(() => {
      expect(mockSendChanges).toHaveBeenCalled();
    });
  });

  it('affiche une erreur RM4 si rescue sans contexte', async () => {
    renderWithProviders(<AddDosePage />);
    await waitFor(() => expect(mockGetGroupKey).toHaveBeenCalledWith('hh-1'));

    fireEvent.click(screen.getByText(/secours|rescue/i));
    fireEvent.click(screen.getByText(/enregistrer|save/i));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(mockAppendDose).not.toHaveBeenCalled();
  });

  it('sauvegarde rescue avec symptôme sélectionné', async () => {
    renderWithProviders(<AddDosePage />);
    await waitFor(() => expect(mockGetGroupKey).toHaveBeenCalledWith('hh-1'));

    fireEvent.click(screen.getByText(/secours|rescue/i));
    fireEvent.click(screen.getByText(/toux|cough/i));
    fireEvent.click(screen.getByText(/enregistrer|save/i));

    await waitFor(() => {
      expect(mockAppendDose).toHaveBeenCalledWith(
        expect.objectContaining({
          doseType: 'rescue',
          symptoms: expect.arrayContaining(['cough']),
        }),
        expect.any(String),
        expect.any(Uint8Array),
      );
    });
  });
});
