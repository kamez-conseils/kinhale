'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';
import { PumpForm, type PumpFormValue } from '@kinhale/ui/pumps';

import { useAuthStore } from '../../../stores/auth-store';
import { useDocStore } from '../../../stores/doc-store';
import { getOrCreateDevice } from '../../../lib/device';
import { useRequireAuth } from '../../../lib/useRequireAuth';
import { useOnlineGuard } from '../../../hooks/useOnlineGuard';
import { buildPumpFormCopy } from '../../../lib/pumps/messages';

export default function PumpAddPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const router = useRouter();
  const authenticated = useRequireAuth();
  const { online } = useOnlineGuard();
  const deviceId = useAuthStore((s) => s.deviceId) ?? '';
  const appendPump = useDocStore((s) => s.appendPump);

  const [value, setValue] = useState<PumpFormValue>({
    name: '',
    kind: 'maint',
    totalDosesStr: '',
    expiresAtStr: '',
    location: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formCopy = React.useMemo(() => buildPumpFormCopy(t), [t]);

  const trimmedName = value.name.trim();
  const totalDoses = parseInt(value.totalDosesStr, 10);
  const validName = trimmedName.length > 0;
  const validDoses = !Number.isNaN(totalDoses) && totalDoses > 0;
  const isValid = validName && validDoses;

  const handleSave = async (): Promise<void> => {
    if (!online || !isValid) return;
    setError(null);
    let expiresAtMs: number | null = null;
    if (value.expiresAtStr.trim() !== '') {
      const parsed = new Date(value.expiresAtStr.trim()).getTime();
      if (Number.isNaN(parsed)) {
        setError(t('pumps.errors.expiryInvalid'));
        return;
      }
      expiresAtMs = parsed;
    }
    setLoading(true);
    try {
      const kp = await getOrCreateDevice();
      await appendPump(
        {
          pumpId: crypto.randomUUID(),
          name: trimmedName,
          pumpType: value.kind === 'maint' ? 'maintenance' : 'rescue',
          totalDoses,
          expiresAtMs,
        },
        deviceId,
        kp.secretKey,
      );
      router.push('/pumps');
    } catch {
      setError(t('pumps.errors.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const errorMessage =
    !validName && value.name.length > 0
      ? t('pumps.errors.nameRequired')
      : !validDoses && value.totalDosesStr.length > 0
        ? t('pumps.errors.dosesInvalid')
        : error;

  if (!authenticated) return null;

  return (
    <Theme name="kinhale_light">
      <YStack flex={1} minHeight="100vh" backgroundColor="$background">
        {/* Header avec back + titre */}
        <YStack
          paddingHorizontal={20}
          paddingTop={20}
          paddingBottom={16}
          borderBottomWidth={0.5}
          borderBottomColor="$borderColor"
        >
          <XStack alignItems="center" gap={8} marginBottom={8}>
            <Text
              tag="button"
              onPress={() => router.push('/pumps')}
              color="$colorMore"
              fontSize={20}
              fontWeight="500"
              paddingHorizontal={6}
              paddingVertical={4}
              cursor="pointer"
              backgroundColor="transparent"
              borderWidth={0}
              accessibilityRole="button"
              accessibilityLabel={t('pumps.cancelCta')}
              hoverStyle={{ opacity: 0.7 }}
            >
              ←
            </Text>
          </XStack>
          <Text
            tag="h1"
            margin={0}
            fontFamily="$heading"
            fontSize={24}
            fontWeight="500"
            letterSpacing={-0.48}
            color="$color"
          >
            {t('pumps.addPageTitle')}
          </Text>
          <Text fontSize={13} color="$colorMore" marginTop={4}>
            {t('pumps.addPageSub')}
          </Text>
        </YStack>

        {/* Form scrollable */}
        <YStack flex={1} padding={20} style={{ overflow: 'auto' }}>
          <YStack maxWidth={520} width="100%" alignSelf="center">
            <PumpForm
              copy={formCopy}
              value={value}
              onChange={setValue}
              errorMessage={errorMessage}
            />

            {!online && (
              <Stack
                marginTop={16}
                paddingHorizontal={14}
                paddingVertical={10}
                borderRadius={10}
                backgroundColor="$amberSoft"
              >
                <Text color="$amberInk" fontSize={12} testID="offline-guard-message" role="status">
                  {t('offlineGuard.message')}
                </Text>
              </Stack>
            )}
          </YStack>
        </YStack>

        {/* Footer CTA */}
        <YStack
          paddingHorizontal={24}
          paddingTop={14}
          paddingBottom={26}
          borderTopWidth={0.5}
          borderTopColor="$borderColor"
          gap={4}
        >
          <YStack maxWidth={520} width="100%" alignSelf="center" gap={8}>
            <XStack
              tag="button"
              cursor={isValid && online ? 'pointer' : 'default'}
              backgroundColor={isValid && online ? '$maint' : '$borderColorStrong'}
              paddingVertical={14}
              borderRadius={14}
              borderWidth={0}
              alignItems="center"
              justifyContent="center"
              onPress={() => void handleSave()}
              disabled={!isValid || !online || loading}
              accessibilityRole="button"
              accessibilityLabel={t('pumps.saveCta')}
              testID="pump-add-save"
              style={
                isValid && online
                  ? { boxShadow: '0 4px 14px color-mix(in oklch, var(--maint) 30%, transparent)' }
                  : undefined
              }
            >
              <Text color="white" fontSize={15} fontWeight="600">
                {loading ? t('pumps.saving') : t('pumps.saveCta')}
              </Text>
            </XStack>
          </YStack>
        </YStack>
      </YStack>
    </Theme>
  );
}
