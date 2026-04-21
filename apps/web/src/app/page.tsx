'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Text, Button } from 'tamagui';
import { useAuthStore } from '../stores/auth-store';

export default function HomePage(): JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (accessToken !== null) {
      router.push('/journal');
    }
  }, [accessToken, router]);

  return (
    <YStack padding="$4" gap="$4" alignItems="center" justifyContent="center" flex={1}>
      <H1>{t('home.title')}</H1>
      <Text fontSize="$5" textAlign="center">
        {t('home.subtitle')}
      </Text>
      <Button onPress={() => router.push('/auth')} width="100%" maxWidth={400}>
        {t('home.getStarted')}
      </Button>
    </YStack>
  );
}
