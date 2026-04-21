'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Text, Button } from 'tamagui';
import { useAuthStore } from '../../stores/auth-store';
import { useDocStore } from '../../stores/doc-store';
import type { SignedEventRecord } from '@kinhale/sync';

export default function JournalPage(): React.JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const householdId = useAuthStore((s) => s.householdId);
  const doc = useDocStore((s) => s.doc);
  const initDoc = useDocStore((s) => s.initDoc);

  useEffect(() => {
    if (accessToken === null) {
      router.push('/auth');
      return;
    }
    if (householdId !== null) {
      initDoc(householdId);
    }
  }, [accessToken, householdId, initDoc, router]);

  const doses: SignedEventRecord[] =
    (doc?.events as SignedEventRecord[] | undefined)?.filter((e) => e.type === 'DoseAdministered') ?? [];

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('journal.title')}</H1>
      {doses.length === 0 && <Text color="$color10">{t('journal.empty')}</Text>}
      {doses.map((e) => (
        <YStack
          key={e.id}
          padding="$3"
          borderWidth={1}
          borderColor="$borderColor"
          borderRadius="$3"
          gap="$1"
        >
          <Text fontSize="$4" fontWeight="600">
            {t('journal.dose')}
          </Text>
          <Text fontSize="$3" color="$color9">
            {new Date(e.occurredAtMs).toLocaleString()}
          </Text>
        </YStack>
      ))}
      <Button onPress={() => router.push('/journal/add')} marginTop="$2">
        {t('journal.addDose')}
      </Button>
    </YStack>
  );
}
