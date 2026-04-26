'use client';

/**
 * Scanner QR web — webcam navigateur + BarcodeDetector natif (KIN-096).
 *
 * Stratégie zéro-dépendance : on s'appuie sur l'API native
 * [`BarcodeDetector`](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector)
 * disponible dans Chrome, Edge et Safari (>= 17.0). Si l'API est absente, le
 * composant remonte `onUnsupported` au parent qui propose alors la saisie
 * manuelle (collage du lien d'invitation) — pas de fallback embarquant une
 * lib JS lourde tant qu'on a un chemin manuel.
 *
 * **Sécurité** :
 *  - Le composant arrête tous les `MediaStreamTrack` à l'unmount **et**
 *    après le 1er scan réussi (cf. kz-securite-KIN-096 §cleanup).
 *  - Aucune frame n'est persistée ; la vidéo est rendue uniquement dans le
 *    `<video>` éphémère.
 *  - Le `rawValue` retourné est traité **non-validé** par le parent (qui
 *    appelle `parseInvitationPayload` strict).
 */

import React from 'react';

interface BarcodeDetectorResult {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

export interface QRScannerProps {
  onScan: (rawValue: string) => void;
  onPermissionDenied?: () => void;
  onUnsupported?: () => void;
  /** Label vidéo pour a11y (audit AXE) — fourni par le parent (i18n). */
  videoAriaLabel?: string;
}

export function QRScanner({
  onScan,
  onPermissionDenied,
  onUnsupported,
  videoAriaLabel,
}: QRScannerProps): React.JSX.Element {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const stoppedRef = React.useRef<boolean>(false);

  // Refs vers les callbacks pour éviter de réabonner getUserMedia à chaque
  // re-render du parent (sinon : flicker de la LED caméra).
  const onScanRef = React.useRef(onScan);
  const onPermissionDeniedRef = React.useRef(onPermissionDenied);
  const onUnsupportedRef = React.useRef(onUnsupported);
  React.useEffect(() => {
    onScanRef.current = onScan;
    onPermissionDeniedRef.current = onPermissionDenied;
    onUnsupportedRef.current = onUnsupported;
  }, [onScan, onPermissionDenied, onUnsupported]);

  React.useEffect(() => {
    const Ctor = getBarcodeDetectorCtor();
    if (Ctor === null) {
      onUnsupportedRef.current?.();
      return;
    }

    let detector: BarcodeDetectorLike;
    try {
      detector = new Ctor({ formats: ['qr_code'] });
    } catch {
      // Très improbable (Chrome/Edge/Safari supportent qr_code), mais protège
      // contre un browser qui implémenterait BarcodeDetector sans qr_code.
      onUnsupportedRef.current?.();
      return;
    }
    let cancelled = false;

    const stopAll = (): void => {
      stoppedRef.current = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const stream = streamRef.current;
      if (stream !== null) {
        for (const track of stream.getTracks()) {
          try {
            track.stop();
          } catch {
            // ignore — track déjà arrêté
          }
        }
        streamRef.current = null;
      }
    };

    const loop = async (): Promise<void> => {
      if (cancelled || stoppedRef.current) return;
      const video = videoRef.current;
      if (video === null) {
        rafRef.current = requestAnimationFrame(() => {
          void loop();
        });
        return;
      }
      try {
        const results = await detector.detect(video);
        if (cancelled || stoppedRef.current) return;
        const first = results[0];
        if (
          first !== undefined &&
          typeof first.rawValue === 'string' &&
          first.rawValue.length > 0
        ) {
          stopAll();
          onScanRef.current(first.rawValue);
          return;
        }
      } catch {
        // detect peut throw si la vidéo n'est pas encore prête (readyState < 2).
        // On retente à la frame suivante.
      }
      if (cancelled || stoppedRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        void loop();
      });
    };

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video !== null) {
          video.srcObject = stream;
          // play() peut rejeter si la lecture auto est bloquée, ou throw
          // synchroniquement dans jsdom. On ignore dans tous les cas.
          try {
            const p = video.play();
            if (p !== undefined && typeof (p as Promise<void>).catch === 'function') {
              (p as Promise<void>).catch(() => undefined);
            }
          } catch {
            // ignore
          }
        }
        rafRef.current = requestAnimationFrame(() => {
          void loop();
        });
      } catch {
        if (!cancelled) onPermissionDeniedRef.current?.();
      }
    })();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      autoPlay
      aria-label={videoAriaLabel}
      style={{ width: '100%', maxWidth: 480, borderRadius: 12, background: '#000' }}
    />
  );
}
