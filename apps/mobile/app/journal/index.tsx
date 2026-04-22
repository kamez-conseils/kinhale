import React, { useEffect, type JSX } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Text, Button } from 'tamagui';
import { useAuthStore } from '../../src/stores/auth-store';
import { useDocStore } from '../../src/stores/doc-store';

type DoseEvent = {
  id: string;
  type: string;
  occurredAtMs: number;
};

export default function JournalScreen(): JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const householdId = useAuthStore((s) => s.householdId);
  const doc = useDocStore((s) => s.doc);
  const initDoc = useDocStore((s) => s.initDoc);

  useEffect(() => {
    if (accessToken === null) {
      router.replace('/auth');
      return;
    }
    if (householdId !== null) {
      void initDoc(householdId);
    }
  }, [accessToken, householdId, initDoc, router]);

  const doses: DoseEvent[] =
    (doc?.events as DoseEvent[] | undefined)?.filter((e) => e.type === 'DoseAdministered') ?? [];

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
      <Button
        onPress={() => router.push('/journal/add')}
        marginTop="$2"
        accessible
        accessibilityRole="button"
      >
        {t('journal.addDose')}
      </Button>
    </YStack>
  );
}
