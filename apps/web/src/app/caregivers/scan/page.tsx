'use client';

/**
 * Page web `/caregivers/scan` — flux QR invite côté aidant invité (KIN-096).
 *
 * Reproduit le pattern existant côté mobile (`apps/mobile/app/caregivers/scan.tsx`)
 * avec les contraintes du navigateur :
 *  - Webcam via `navigator.mediaDevices.getUserMedia`.
 *  - Détection QR via `BarcodeDetector` natif (Chrome/Edge/Safari).
 *  - Fallback gracieux vers une saisie manuelle (collage du lien d'invitation)
 *    si la caméra est refusée OU si BarcodeDetector n'est pas supporté.
 *
 * Le composant ne fait **aucun** appel réseau lui-même : il se borne à
 * extraire `{ token, pin }` du QR (via le parser strict `parseInvitationPayload`)
 * et redirige vers la page existante `/accept-invitation/[token]?pin=…` qui
 * gère consentement + appel `POST /invitations/:token/accept`.
 *
 * Refs : KIN-096, issue #349, kz-securite-KIN-096.md.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { YStack, XStack, Text, Button, Input } from 'tamagui';
import { QRScanner } from '../../../components/QRScanner';
import { parseInvitationPayload } from '../../../lib/invitation-qr';
import { useRequireAuth } from '../../../lib/useRequireAuth';

type Mode = 'idle' | 'scanning' | 'manual';
type Status = 'ready' | 'permission-denied' | 'unsupported' | 'invalid';

export default function ScanPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();

  const [mode, setMode] = React.useState<Mode>('idle');
  const [status, setStatus] = React.useState<Status>('ready');
  const [manualValue, setManualValue] = React.useState<string>('');

  const handlePayload = React.useCallback(
    (raw: string): void => {
      try {
        const { token, pin } = parseInvitationPayload(raw);
        const query = pin !== '' ? `?pin=${encodeURIComponent(pin)}` : '';
        router.push(`/accept-invitation/${encodeURIComponent(token)}${query}`);
      } catch {
        // Pas de log du `raw` : pourrait contenir un QR malicieux ou une chaîne
        // arbitraire scannée par erreur (anti-fuite info — kz-securite §logging).
        setStatus('invalid');
        setMode('idle');
      }
    },
    [router],
  );

  const handleStartScan = (): void => {
    setStatus('ready');
    setMode('scanning');
  };

  const handleManualOpen = (): void => {
    setStatus('ready');
    setMode('manual');
    setManualValue('');
  };

  const handleManualSubmit = (): void => {
    handlePayload(manualValue.trim());
  };

  if (!authenticated) return null;

  return (
    <YStack padding="$4" gap="$3">
      <Text fontSize="$6" fontWeight="bold" accessibilityRole="header">
        {t('invitation.scan.title')}
      </Text>
      <Text>{t('invitation.scan.instruction')}</Text>

      {mode === 'scanning' ? (
        <YStack gap="$3">
          <QRScanner
            onScan={handlePayload}
            onPermissionDenied={() => {
              setStatus('permission-denied');
              setMode('idle');
            }}
            onUnsupported={() => {
              setStatus('unsupported');
              setMode('idle');
            }}
            videoAriaLabel={t('invitation.scan.title')}
          />
          <Button
            onPress={() => setMode('idle')}
            backgroundColor="$backgroundStrong"
            color="$color"
            borderColor="$borderColor"
            borderWidth={2}
            accessibilityLabel={t('invitation.scan.stopCta')}
          >
            {t('invitation.scan.stopCta')}
          </Button>
        </YStack>
      ) : null}

      {mode === 'manual' ? (
        <YStack gap="$2">
          <Text>{t('invitation.scan.manualLabel')}</Text>
          <Input
            value={manualValue}
            onChangeText={(v: string) => setManualValue(v)}
            placeholder={t('invitation.scan.manualPlaceholder')}
            accessibilityLabel={t('invitation.scan.manualLabel')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            onPress={handleManualSubmit}
            disabled={manualValue.trim().length === 0}
            backgroundColor="$blue9"
            color="white"
            borderColor="$blue10"
            borderWidth={2}
            accessibilityLabel={t('invitation.scan.manualSubmit')}
          >
            {t('invitation.scan.manualSubmit')}
          </Button>
        </YStack>
      ) : null}

      {mode === 'idle' ? (
        <XStack gap="$2" flexWrap="wrap">
          <Button
            onPress={handleStartScan}
            backgroundColor="$blue9"
            color="white"
            borderColor="$blue10"
            borderWidth={2}
            accessibilityLabel={t('invitation.scan.startCta')}
          >
            {t('invitation.scan.startCta')}
          </Button>
          <Button
            onPress={handleManualOpen}
            backgroundColor="$backgroundStrong"
            color="$color"
            borderColor="$borderColor"
            borderWidth={2}
            accessibilityLabel={t('invitation.scan.manualCta')}
          >
            {t('invitation.scan.manualCta')}
          </Button>
        </XStack>
      ) : null}

      {status === 'permission-denied' ? (
        <Text color="$orange10" role="status">
          {t('invitation.scan.cameraPermissionDenied')}
        </Text>
      ) : null}
      {status === 'unsupported' ? (
        <Text color="$orange10" role="status">
          {t('invitation.scan.barcodeUnsupported')}
        </Text>
      ) : null}
      {status === 'invalid' ? (
        <Text color="$red10" role="alert">
          {t('invitation.scan.invalidQr')}
        </Text>
      ) : null}
    </YStack>
  );
}
