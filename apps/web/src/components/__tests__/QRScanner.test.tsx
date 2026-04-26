/**
 * Tests QRScanner web (KIN-096).
 *
 * Stratégie : on mocke `navigator.mediaDevices.getUserMedia` et la classe
 * `BarcodeDetector` côté global. Le composant doit :
 *  1. Demander la permission caméra au montage.
 *  2. Si refusée → callback `onPermissionDenied` (et pas de stream).
 *  3. Si BarcodeDetector indisponible → callback `onUnsupported`.
 *  4. À chaque frame, lire un QR via BarcodeDetector ; si trouvé, callback
 *     `onScan(rawValue)`. Le composant doit cesser de scanner après le 1er hit.
 *  5. À l'unmount, arrêter tous les `MediaStreamTrack` (anti-fuite caméra,
 *     LED reste allumée sinon — cf. kz-securite §cleanup).
 */

import React from 'react';
import { act, render } from '@testing-library/react';
import { QRScanner } from '../QRScanner';

interface MockTrack {
  stop: jest.Mock;
}

interface MockStream {
  getTracks: () => MockTrack[];
}

const TamaguiProvider = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <>{children}</>
);

// On évite TamaguiProvider ici pour ne pas dépendre du scheduler — le
// composant utilise <video> + <button> bruts.

describe('QRScanner', () => {
  let originalBarcodeDetector: unknown;
  let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame;
  let originalCancelAnimationFrame: typeof globalThis.cancelAnimationFrame;

  let track: MockTrack;
  let stream: MockStream;
  let detectMock: jest.Mock;

  beforeEach(() => {
    track = { stop: jest.fn() };
    stream = { getTracks: () => [track] };

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: jest.fn().mockResolvedValue(stream),
      },
    });

    detectMock = jest.fn().mockResolvedValue([]);
    class FakeBarcodeDetector {
      detect = detectMock;
    }
    originalBarcodeDetector = (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;
    (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector = FakeBarcodeDetector;

    // RAF synchrone pour piloter la boucle dans les tests.
    originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      // On stocke le callback pour le déclencher manuellement via tickRAF.
      pendingRAF.push(cb);
      return pendingRAF.length;
    };
    globalThis.cancelAnimationFrame = (): void => {
      pendingRAF.length = 0;
    };
  });

  const pendingRAF: FrameRequestCallback[] = [];
  function tickRAF(): void {
    const cb = pendingRAF.shift();
    if (cb !== undefined) cb(performance.now());
  }

  afterEach(() => {
    pendingRAF.length = 0;
    (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector =
      originalBarcodeDetector as undefined;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('appelle onUnsupported si BarcodeDetector est absent', async () => {
    delete (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;

    const onScan = jest.fn();
    const onPermissionDenied = jest.fn();
    const onUnsupported = jest.fn();

    render(
      <TamaguiProvider>
        <QRScanner
          onScan={onScan}
          onPermissionDenied={onPermissionDenied}
          onUnsupported={onUnsupported}
        />
      </TamaguiProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(onUnsupported).toHaveBeenCalled();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(onScan).not.toHaveBeenCalled();
  });

  it('appelle onPermissionDenied si getUserMedia rejette', async () => {
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValueOnce(
      new DOMException('denied', 'NotAllowedError'),
    );
    const onScan = jest.fn();
    const onPermissionDenied = jest.fn();

    render(
      <TamaguiProvider>
        <QRScanner onScan={onScan} onPermissionDenied={onPermissionDenied} />
      </TamaguiProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onPermissionDenied).toHaveBeenCalled();
    expect(onScan).not.toHaveBeenCalled();
  });

  it('appelle onScan quand un QR est détecté puis arrête la boucle', async () => {
    detectMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ rawValue: 'kinhale://accept/tok-1?pin=123456' }]);

    const onScan = jest.fn();

    render(
      <TamaguiProvider>
        <QRScanner onScan={onScan} />
      </TamaguiProvider>,
    );

    // Attente : permission + stream installés.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Première frame : detect renvoie vide
    await act(async () => {
      tickRAF();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onScan).not.toHaveBeenCalled();

    // Deuxième frame : detect renvoie un QR
    await act(async () => {
      tickRAF();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onScan).toHaveBeenCalledWith('kinhale://accept/tok-1?pin=123456');

    // Après le hit, on ne doit plus relancer requestAnimationFrame — vérifier
    // que la file s'est vidée.
    expect(pendingRAF.length).toBe(0);
  });

  it("arrête tous les tracks de la caméra à l'unmount", async () => {
    const { unmount } = render(
      <TamaguiProvider>
        <QRScanner onScan={jest.fn()} />
      </TamaguiProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    unmount();

    expect(track.stop).toHaveBeenCalled();
  });
});
