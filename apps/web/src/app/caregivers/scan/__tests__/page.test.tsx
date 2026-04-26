import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import ScanPage from '../page';
import { renderWithProviders } from '../../../../test-utils/render';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

let mockAccessToken: string | null = 'tok-valid';
jest.mock('../../../../stores/auth-store', () => ({
  useAuthStore: jest.fn((selector: (s: { accessToken: string | null }) => unknown) =>
    selector({ accessToken: mockAccessToken }),
  ),
}));

// On stub QRScanner pour tester la page sans dépendre de la webcam.
let scannerOnScan: ((rawValue: string) => void) | null = null;
let scannerOnPermissionDenied: (() => void) | null = null;
let scannerOnUnsupported: (() => void) | null = null;
jest.mock('../../../../components/QRScanner', () => ({
  QRScanner: ({
    onScan,
    onPermissionDenied,
    onUnsupported,
  }: {
    onScan: (raw: string) => void;
    onPermissionDenied?: () => void;
    onUnsupported?: () => void;
  }) => {
    scannerOnScan = onScan;
    scannerOnPermissionDenied = onPermissionDenied ?? null;
    scannerOnUnsupported = onUnsupported ?? null;
    return <div data-testid="qr-scanner-stub" />;
  },
}));

describe('ScanPage', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-valid';
    scannerOnScan = null;
    scannerOnPermissionDenied = null;
    scannerOnUnsupported = null;
  });

  async function flushReact(): Promise<void> {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("affiche le titre et le bouton 'Démarrer le scan' à l'ouverture", async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<ScanPage />);
      await flushReact();
      expect(screen.getByText(/scanner l'invitation|scan invitation/i)).toBeTruthy();
      expect(screen.getByText(/démarrer le scan|start scan/i)).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it("démarre le scanner au clic sur 'Démarrer le scan'", async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<ScanPage />);
      await flushReact();
      fireEvent.click(screen.getByText(/démarrer le scan|start scan/i));
      await flushReact();
      expect(screen.getByTestId('qr-scanner-stub')).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it("redirige vers /accept-invitation/[token]?pin=… après scan d'un QR valide", async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<ScanPage />);
      await flushReact();
      fireEvent.click(screen.getByText(/démarrer le scan|start scan/i));
      await flushReact();

      // Simule un QR détecté par le scanner
      act(() => {
        scannerOnScan?.('kinhale://accept/tok-abcd?pin=123456');
      });
      await flushReact();

      expect(mockPush).toHaveBeenCalledWith('/accept-invitation/tok-abcd?pin=123456');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche une erreur localisée et permet de retry quand le QR est invalide', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<ScanPage />);
      await flushReact();
      fireEvent.click(screen.getByText(/démarrer le scan|start scan/i));
      await flushReact();

      act(() => {
        scannerOnScan?.('not-a-kinhale-url');
      });
      await flushReact();

      expect(
        screen.getByText(/code n'est pas une invitation|not a valid kinhale invitation/i),
      ).toBeTruthy();
      // Pas de redirection
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche le formulaire de saisie manuelle au clic et redirige après un lien valide', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<ScanPage />);
      await flushReact();
      fireEvent.click(screen.getByText(/saisir manuellement le code|enter the code manually/i));
      await flushReact();

      const input = screen.getByPlaceholderText(/kinhale:\/\/accept/);
      fireEvent.change(input, { target: { value: 'kinhale://accept/tok-manu?pin=654321' } });
      fireEvent.click(screen.getByText(/^continuer$|^continue$/i));
      await flushReact();

      expect(mockPush).toHaveBeenCalledWith('/accept-invitation/tok-manu?pin=654321');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche un message si la permission caméra est refusée', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<ScanPage />);
      await flushReact();
      fireEvent.click(screen.getByText(/démarrer le scan|start scan/i));
      await flushReact();

      act(() => {
        scannerOnPermissionDenied?.();
      });
      await flushReact();

      expect(screen.getByText(/caméra refusée|camera denied/i)).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it("affiche un message si BarcodeDetector n'est pas supporté", async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<ScanPage />);
      await flushReact();
      fireEvent.click(screen.getByText(/démarrer le scan|start scan/i));
      await flushReact();

      act(() => {
        scannerOnUnsupported?.();
      });
      await flushReact();

      expect(
        screen.getByText(/navigateur ne détecte pas les QR|browser cannot detect QR/i),
      ).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('redirige vers /auth si pas de session', async () => {
    mockAccessToken = null;
    jest.useFakeTimers();
    try {
      renderWithProviders(<ScanPage />);
      await flushReact();
      expect(mockReplace).toHaveBeenCalledWith('/auth');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
