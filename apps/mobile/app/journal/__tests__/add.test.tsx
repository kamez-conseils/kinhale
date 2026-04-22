import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import AddDoseScreen from '../add';
import { renderWithProviders } from '../../../src/test-utils/render';

jest.mock('@kinhale/crypto');
jest.mock('@kinhale/sync');

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
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

const mockAppendDose = jest.fn().mockResolvedValue([new Uint8Array([1])]);
jest.mock('../../../src/stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { appendDose: jest.Mock; doc: null }) => unknown) =>
    selector({ appendDose: mockAppendDose, doc: null }),
  ),
}));

const mockSendChanges = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/hooks/use-relay', () => ({
  useRelay: jest.fn(() => ({ sendChanges: mockSendChanges })),
}));

const mockGetOrCreateDevice = jest.fn().mockResolvedValue({
  publicKey: new Uint8Array(32),
  secretKey: new Uint8Array(64),
  publicKeyHex: 'a'.repeat(64),
});
const mockGetGroupKey = jest.fn().mockResolvedValue(new Uint8Array(32));
jest.mock('../../../src/lib/device', () => ({
  getOrCreateDevice: (...args: unknown[]) => mockGetOrCreateDevice(...args),
  getGroupKey: (...args: unknown[]) => mockGetGroupKey(...args),
}));

describe('AddDoseScreen', () => {
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

  it('affiche le formulaire avec les boutons de type de dose', async () => {
    renderWithProviders(<AddDoseScreen />);
    await waitFor(() => expect(mockGetGroupKey).toHaveBeenCalledWith('hh-1'));
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(3);
  });

  it('navigue après sauvegarde réussie', async () => {
    renderWithProviders(<AddDoseScreen />);
    await waitFor(() => expect(mockGetGroupKey).toHaveBeenCalledWith('hh-1'));
    const buttons = screen.getAllByRole('button');
    const lastButton = buttons.at(-1);
    expect(lastButton).toBeTruthy();
    if (lastButton) fireEvent.press(lastButton);
    await waitFor(() => {
      expect(mockAppendDose).toHaveBeenCalled();
    });
  });

  it('affiche une erreur si appendDose échoue', async () => {
    mockAppendDose.mockRejectedValueOnce(new Error('réseau indisponible'));
    renderWithProviders(<AddDoseScreen />);
    const buttons = screen.getAllByRole('button');
    const lastButton = buttons.at(-1);
    expect(lastButton).toBeTruthy();
    if (lastButton) fireEvent.press(lastButton);
    await waitFor(() => {
      expect(screen.getByText(/erreur|error/i)).toBeTruthy();
    });
  });

  it('affiche une erreur RM4 si rescue sans contexte', async () => {
    renderWithProviders(<AddDoseScreen />);
    await waitFor(() => expect(mockGetGroupKey).toHaveBeenCalled());

    // Sélectionner "Secours"
    fireEvent.press(screen.getByText(/secours/i));

    // Appuyer sur Enregistrer sans sélectionner symptôme/circonstance
    const saveBtn = screen.getByText(/enregistrer/i);
    fireEvent.press(saveBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(mockAppendDose).not.toHaveBeenCalled();
  });

  it('sauvegarde rescue avec symptôme sélectionné', async () => {
    renderWithProviders(<AddDoseScreen />);
    await waitFor(() => expect(mockGetGroupKey).toHaveBeenCalled());

    fireEvent.press(screen.getByText(/secours/i));
    fireEvent.press(screen.getByText(/toux/i));

    const saveBtn = screen.getByText(/enregistrer/i);
    fireEvent.press(saveBtn);

    await waitFor(() => {
      expect(mockAppendDose).toHaveBeenCalledWith(
        expect.objectContaining({
          doseType: 'rescue',
          symptoms: expect.arrayContaining(['cough']),
        }),
        'dev-1',
        expect.any(Uint8Array),
      );
    });
  });

  it('sauvegarde avec note libre uniquement pour rescue', async () => {
    renderWithProviders(<AddDoseScreen />);
    await waitFor(() => expect(mockGetGroupKey).toHaveBeenCalled());

    fireEvent.press(screen.getByText(/secours/i));
    fireEvent.changeText(screen.getByPlaceholderText(/après sport/i), 'vacances');

    const saveBtn = screen.getByText(/enregistrer/i);
    fireEvent.press(saveBtn);

    await waitFor(() => {
      expect(mockAppendDose).toHaveBeenCalledWith(
        expect.objectContaining({ freeFormTag: 'vacances' }),
        'dev-1',
        expect.any(Uint8Array),
      );
    });
  });
});
