import React from 'react';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, Text, Switch, Card, Input, Button } from 'tamagui';
import {
  getQuietHours,
  updateQuietHours,
  detectLocalTimezone,
  type QuietHoursConfig,
} from '../lib/quiet-hours/client';

// Regex stricte HH:mm avec zéro padding (miroir du domaine `parseLocalTime`).
const HHMM_RE = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

/**
 * Section « Heures silencieuses » intégrée à l'écran Paramètres /
 * Notifications sur mobile. Équivalent fonctionnel de la version web :
 * validation locale HH:mm, auto-détection du fuseau si `timezone === 'UTC'`,
 * feedback succès/erreur i18n.
 *
 * Les inputs numériques utilisent `keyboardType="numeric"` pour le clavier
 * natif — un vrai time picker natif pourra être ajouté dans un follow-up.
 */
export function QuietHoursSection(): React.JSX.Element {
  const { t } = useTranslation('common');
  const [config, setConfig] = React.useState<QuietHoursConfig | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);

  const refresh = React.useCallback(async () => {
    try {
      const fromServer = await getQuietHours();
      // Remplace UTC par le fuseau local détecté : l'UI affiche tout de suite
      // une valeur sensée plutôt que forcer l'utilisateur à corriger.
      const tz = fromServer.timezone === 'UTC' ? detectLocalTimezone() : fromServer.timezone;
      setConfig({ ...fromServer, timezone: tz });
      setLoadError(null);
    } catch {
      setLoadError(t('quietHours.loadError'));
    }
  }, [t]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const setField = <K extends keyof QuietHoursConfig>(key: K, value: QuietHoursConfig[K]): void => {
    setSaveSuccess(false);
    setValidationError(null);
    setSaveError(null);
    setConfig((prev) => (prev === null ? prev : { ...prev, [key]: value }));
  };

  const handleSave = async (): Promise<void> => {
    if (config === null) return;
    if (!HHMM_RE.test(config.startLocalTime) || !HHMM_RE.test(config.endLocalTime)) {
      setValidationError(t('quietHours.invalidFormat'));
      return;
    }
    setSaving(true);
    try {
      await updateQuietHours(config);
      setSaveError(null);
      setSaveSuccess(true);
    } catch {
      setSaveError(t('quietHours.saveError'));
      setSaveSuccess(false);
    } finally {
      setSaving(false);
    }
  };

  if (config === null) {
    return (
      <Card padding="$3">
        {loadError !== null ? (
          <Text color="$red10">{loadError}</Text>
        ) : (
          <Text>{t('common.loading')}</Text>
        )}
      </Card>
    );
  }

  return (
    <Card padding="$3">
      <YStack gap="$3">
        <Text fontSize="$5" fontWeight="bold" accessibilityRole="header">
          {t('quietHours.title')}
        </Text>
        <Text fontSize="$2">{t('quietHours.description')}</Text>
        <Text fontSize="$1" color="$gray10">
          {t('quietHours.safetyNote')}
        </Text>

        {loadError !== null ? <Text color="$red10">{loadError}</Text> : null}

        <XStack justifyContent="space-between" alignItems="center">
          <Text fontWeight="bold">{t('quietHours.enabledLabel')}</Text>
          <Switch
            size="$3"
            checked={config.enabled}
            onCheckedChange={(next: boolean) => setField('enabled', next)}
            accessibilityRole="switch"
            accessibilityLabel={t('quietHours.enabledLabel')}
            accessibilityState={{ checked: config.enabled }}
          >
            <Switch.Thumb animation="quick" />
          </Switch>
        </XStack>

        <YStack gap="$2">
          <Text>{t('quietHours.startLabel')}</Text>
          <Input
            value={config.startLocalTime}
            onChangeText={(v: string) => setField('startLocalTime', v)}
            placeholder="22:00"
            keyboardType="numeric"
            maxLength={5}
            accessibilityLabel={t('quietHours.startLabel')}
          />
        </YStack>

        <YStack gap="$2">
          <Text>{t('quietHours.endLabel')}</Text>
          <Input
            value={config.endLocalTime}
            onChangeText={(v: string) => setField('endLocalTime', v)}
            placeholder="07:00"
            keyboardType="numeric"
            maxLength={5}
            accessibilityLabel={t('quietHours.endLabel')}
          />
        </YStack>

        <YStack gap="$2">
          <Text>{t('quietHours.timezoneLabel')}</Text>
          <Input
            value={config.timezone}
            onChangeText={(v: string) => setField('timezone', v)}
            placeholder="America/Toronto"
            accessibilityLabel={t('quietHours.timezoneLabel')}
          />
          <Text fontSize="$1" color="$gray10">
            {t('quietHours.timezoneAutoDetected', { timezone: detectLocalTimezone() })}
          </Text>
        </YStack>

        {validationError !== null ? <Text color="$red10">{validationError}</Text> : null}
        {saveError !== null ? <Text color="$red10">{saveError}</Text> : null}
        {saveSuccess ? <Text color="$green10">{t('quietHours.saveSuccess')}</Text> : null}

        <Button
          onPress={() => void handleSave()}
          disabled={saving}
          accessibilityLabel={t('quietHours.save')}
          accessibilityRole="button"
        >
          {saving ? t('quietHours.saving') : t('quietHours.save')}
        </Button>
      </YStack>
    </Card>
  );
}
