import React from 'react';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, Text, Card, Switch } from 'tamagui';
import {
  listNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreference,
  type NotificationType,
} from '../../src/lib/notification-preferences/client';

export default function NotificationPreferencesScreen(): React.JSX.Element {
  const { t } = useTranslation('common');
  const [preferences, setPreferences] = React.useState<ReadonlyArray<NotificationPreference>>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<Set<NotificationType>>(new Set());

  const refresh = React.useCallback(async () => {
    try {
      setPreferences(await listNotificationPreferences());
      setError(null);
    } catch {
      setError(t('notificationPreferences.loadError'));
    }
  }, [t]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleToggle = async (type: NotificationType, enabled: boolean): Promise<void> => {
    setPending((prev) => {
      const next = new Set(prev);
      next.add(type);
      return next;
    });
    try {
      await updateNotificationPreference(type, enabled);
      setError(null);
      await refresh();
    } catch {
      setError(t('notificationPreferences.saveError'));
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(type);
        return next;
      });
    }
  };

  return (
    <YStack padding="$4" gap="$3">
      <Text fontSize="$6" fontWeight="bold" accessibilityRole="header">
        {t('notificationPreferences.title')}
      </Text>
      <Text>{t('notificationPreferences.description')}</Text>

      {error !== null ? <Text color="$red10">{error}</Text> : null}

      {preferences.map((pref) => (
        <Card key={pref.type} padding="$3">
          <XStack justifyContent="space-between" alignItems="center" gap="$3">
            <YStack flex={1} gap="$1">
              <Text fontWeight="bold">{t(`notificationPreferences.types.${pref.type}.label`)}</Text>
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
              size="$3"
              checked={pref.enabled}
              disabled={pref.alwaysEnabled || pending.has(pref.type)}
              onCheckedChange={(next: boolean) => {
                if (pref.alwaysEnabled) return;
                void handleToggle(pref.type, next);
              }}
              accessibilityRole="switch"
              accessibilityLabel={t(`notificationPreferences.types.${pref.type}.label`)}
              accessibilityState={{
                checked: pref.enabled,
                disabled: pref.alwaysEnabled,
              }}
            >
              <Switch.Thumb animation="quick" />
            </Switch>
          </XStack>
        </Card>
      ))}
    </YStack>
  );
}
