import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Camera, CameraView } from 'expo-camera';
import { YStack, Text } from 'tamagui';

export default function ScanInvitationScreen(): React.JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [permission, setPermission] = React.useState<boolean | null>(null);
  const [scanned, setScanned] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setPermission(status === 'granted');
    })();
  }, []);

  const onScanned = (event: { data: string }): void => {
    if (scanned) return;
    setScanned(true);
    try {
      const url = new URL(event.data);
      const parts = url.pathname.split('/').filter(Boolean);
      const token = parts[parts.length - 1] ?? '';
      const pin = url.searchParams.get('pin') ?? '';
      if (token === '') {
        setScanned(false);
        return;
      }
      router.push({ pathname: '/caregivers/accept/[token]', params: { token, pin } });
    } catch {
      setScanned(false);
    }
  };

  if (permission === null) {
    return (
      <YStack padding="$4" gap="$3">
        <Text>…</Text>
      </YStack>
    );
  }

  if (!permission) {
    return (
      <YStack padding="$4" gap="$3">
        <Text accessibilityRole="text">{t('invitation.cameraPermissionDenied')}</Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onScanned}
      />
    </YStack>
  );
}
