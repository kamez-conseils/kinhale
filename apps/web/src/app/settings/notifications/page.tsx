'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { YStack, XStack, Text, Switch, Card, Label } from 'tamagui';
import {
  listNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreference,
  type NotificationType,
} from '../../../lib/notification-preferences/client';
import { useRequireAuth } from '../../../lib/useRequireAuth';
import { QuietHoursSection } from '../../../components/QuietHoursSection';

const PREFS_QUERY_KEY = ['notification-preferences'] as const;

export default function NotificationPreferencesPage(): React.JSX.Element | null {
  const { t } = useTranslation('common');
  const authenticated = useRequireAuth();
  const queryClient = useQueryClient();

  const { data, error, isLoading } = useQuery({
    queryKey: PREFS_QUERY_KEY,
    queryFn: listNotificationPreferences,
    enabled: authenticated,
  });

  const [mutationError, setMutationError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ type, enabled }: { type: NotificationType; enabled: boolean }) =>
      updateNotificationPreference(type, enabled),
    onSuccess: async () => {
      setMutationError(null);
      await queryClient.invalidateQueries({ queryKey: PREFS_QUERY_KEY });
    },
    onError: () => {
      setMutationError(t('notificationPreferences.saveError'));
    },
  });

  if (!authenticated) return null;

  return (
    <YStack padding="$4" gap="$3">
      <Text fontSize="$6" fontWeight="bold">
        {t('notificationPreferences.title')}
      </Text>
      <Text>{t('notificationPreferences.description')}</Text>

      {isLoading ? <Text>{t('common.loading')}</Text> : null}
      {error !== null && error !== undefined ? (
        <Text color="$red10">{t('notificationPreferences.loadError')}</Text>
      ) : null}
      {mutationError !== null ? <Text color="$red10">{mutationError}</Text> : null}

      <QuietHoursSection />

      {data?.map((pref: NotificationPreference) => (
        <Card key={pref.type} padding="$3">
          <XStack justifyContent="space-between" alignItems="center" gap="$3">
            <YStack flex={1} gap="$1">
              <Label htmlFor={`notif-pref-${pref.type}`} fontWeight="bold">
                {t(`notificationPreferences.types.${pref.type}.label`)}
              </Label>
              <Text fontSize="$2">
                {t(`notificationPreferences.types.${pref.type}.description`)}
              </Text>
              {pref.alwaysEnabled ? (
                <Text fontSize="$1" color="$gray10">
                  {t('notificationPreferences.alwaysEnabledTooltip')}
                </Text>
              ) : null}
            </YStack>
            <Switch
              id={`notif-pref-${pref.type}`}
              size="$3"
              checked={pref.enabled}
              disabled={pref.alwaysEnabled || mutation.isPending}
              onCheckedChange={(next: boolean) => {
                if (pref.alwaysEnabled) return;
                mutation.mutate({ type: pref.type, enabled: next });
              }}
              aria-label={t(`notificationPreferences.types.${pref.type}.label`)}
            >
              <Switch.Thumb animation="quick" />
            </Switch>
          </XStack>
        </Card>
      ))}
    </YStack>
  );
}
