'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Text, Button, XStack } from 'tamagui';
import { projectDoses } from '@kinhale/sync';
import { useAuthStore } from '../../stores/auth-store';
import { useDocStore } from '../../stores/doc-store';

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

  const doses = doc !== null ? projectDoses(doc) : [];

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('journal.title')}</H1>
      {doses.length === 0 && <Text color="$color10">{t('journal.empty')}</Text>}
      {doses.map((dose) => (
        <YStack
          key={dose.eventId}
          padding="$3"
          borderWidth={1}
          borderColor="$borderColor"
          borderRadius="$3"
          gap="$2"
        >
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize="$4" fontWeight="700">
              {dose.doseType === 'rescue' ? t('journal.rescue') : t('journal.maintenance')}
            </Text>
            <Text fontSize="$2" color="$color9">
              {new Date(dose.administeredAtMs).toLocaleString()}
            </Text>
          </XStack>

          {dose.symptoms.length > 0 && (
            <Text fontSize="$3" color="$color10">
              {dose.symptoms.map((s) => t(`journal.symptom.${s}`)).join(' · ')}
            </Text>
          )}

          {dose.circumstances.length > 0 && (
            <Text fontSize="$3" color="$color10">
              {dose.circumstances.map((c) => t(`journal.circumstance.${c}`)).join(' · ')}
            </Text>
          )}

          {dose.freeFormTag !== null && (
            <Text fontSize="$3" color="$color9" fontStyle="italic">
              {dose.freeFormTag}
            </Text>
          )}
        </YStack>
      ))}
      <Button onPress={() => router.push('/journal/add')} marginTop="$2">
        {t('journal.addDose')}
      </Button>
    </YStack>
  );
}
