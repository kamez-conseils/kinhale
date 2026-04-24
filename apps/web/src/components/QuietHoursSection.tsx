'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { YStack, XStack, Text, Switch, Card, Label, Input, Button } from 'tamagui';
import {
  getQuietHours,
  updateQuietHours,
  detectLocalTimezone,
  type QuietHoursConfig,
} from '../lib/quiet-hours/client';

const QUIET_QUERY_KEY = ['quiet-hours'] as const;

// Regex stricte HH:mm avec zéro padding (identique à `parseLocalTime` du domaine).
const HHMM_RE = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

/**
 * Section « Heures silencieuses » intégrée à l'écran Paramètres / Notifications.
 *
 * Comportements :
 * - Charge la config depuis `GET /me/quiet-hours` au montage.
 * - Détecte le fuseau local du navigateur (`Intl`) au premier chargement si
 *   le serveur renvoie encore le défaut (`timezone === 'UTC'`).
 * - Valide localement le format HH:mm avant d'émettre le PUT pour afficher
 *   une erreur i18n immédiate (sans aller-retour serveur).
 * - Toggle « Activer » désactivé = les champs heures restent visibles mais
 *   sans effet serveur tant que `enabled` est false.
 */
export function QuietHoursSection(): React.JSX.Element {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  const { data, error, isLoading } = useQuery({
    queryKey: QUIET_QUERY_KEY,
    queryFn: getQuietHours,
  });

  const [form, setForm] = React.useState<QuietHoursConfig | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState<boolean>(false);

  // Hydrate le formulaire au premier chargement ; remplace le timezone "UTC"
  // par le fuseau détecté côté client (meilleure UX pour un premier accès).
  React.useEffect(() => {
    if (data !== undefined && form === null) {
      const tz = data.timezone === 'UTC' ? detectLocalTimezone() : data.timezone;
      setForm({ ...data, timezone: tz });
    }
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: (config: QuietHoursConfig) => updateQuietHours(config),
    onSuccess: async () => {
      setValidationError(null);
      setSaveSuccess(true);
      await queryClient.invalidateQueries({ queryKey: QUIET_QUERY_KEY });
    },
    onError: () => {
      setSaveSuccess(false);
      setValidationError(t('quietHours.saveError'));
    },
  });

  const handleSave = (): void => {
    if (form === null) return;
    if (!HHMM_RE.test(form.startLocalTime) || !HHMM_RE.test(form.endLocalTime)) {
      setValidationError(t('quietHours.invalidFormat'));
      setSaveSuccess(false);
      return;
    }
    mutation.mutate(form);
  };

  const setField = <K extends keyof QuietHoursConfig>(key: K, value: QuietHoursConfig[K]): void => {
    setSaveSuccess(false);
    setValidationError(null);
    setForm((prev) => (prev === null ? prev : { ...prev, [key]: value }));
  };

  if (error !== null && error !== undefined && form === null) {
    // Le chargement a échoué avant toute hydratation — affiche l'erreur
    // i18n plutôt que l'écran de chargement indéfiniment.
    return (
      <Card padding="$3">
        <Text color="$red10">{t('quietHours.loadError')}</Text>
      </Card>
    );
  }

  if (isLoading || form === null) {
    return (
      <Card padding="$3">
        <Text>{t('common.loading')}</Text>
      </Card>
    );
  }

  return (
    <Card padding="$3" testID="quiet-hours-section">
      <YStack gap="$3">
        <Text fontSize="$5" fontWeight="bold">
          {t('quietHours.title')}
        </Text>
        <Text fontSize="$2">{t('quietHours.description')}</Text>
        <Text fontSize="$1" color="$gray10">
          {t('quietHours.safetyNote')}
        </Text>

        {error !== null && error !== undefined ? (
          <Text color="$red10">{t('quietHours.loadError')}</Text>
        ) : null}

        <XStack justifyContent="space-between" alignItems="center">
          <Label htmlFor="qh-enabled" fontWeight="bold">
            {t('quietHours.enabledLabel')}
          </Label>
          <Switch
            id="qh-enabled"
            size="$3"
            checked={form.enabled}
            onCheckedChange={(next: boolean) => setField('enabled', next)}
            aria-label={t('quietHours.enabledLabel')}
          >
            <Switch.Thumb animation="quick" />
          </Switch>
        </XStack>

        <YStack gap="$2">
          <Label htmlFor="qh-start">{t('quietHours.startLabel')}</Label>
          <Input
            id="qh-start"
            value={form.startLocalTime}
            onChangeText={(v: string) => setField('startLocalTime', v)}
            placeholder="22:00"
            inputMode="numeric"
            maxLength={5}
            aria-label={t('quietHours.startLabel')}
          />
        </YStack>

        <YStack gap="$2">
          <Label htmlFor="qh-end">{t('quietHours.endLabel')}</Label>
          <Input
            id="qh-end"
            value={form.endLocalTime}
            onChangeText={(v: string) => setField('endLocalTime', v)}
            placeholder="07:00"
            inputMode="numeric"
            maxLength={5}
            aria-label={t('quietHours.endLabel')}
          />
        </YStack>

        <YStack gap="$2">
          <Label htmlFor="qh-tz">{t('quietHours.timezoneLabel')}</Label>
          <Input
            id="qh-tz"
            value={form.timezone}
            onChangeText={(v: string) => setField('timezone', v)}
            placeholder="America/Toronto"
            aria-label={t('quietHours.timezoneLabel')}
          />
          <Text fontSize="$1" color="$gray10">
            {t('quietHours.timezoneAutoDetected', { timezone: detectLocalTimezone() })}
          </Text>
        </YStack>

        {validationError !== null ? <Text color="$red10">{validationError}</Text> : null}
        {saveSuccess ? <Text color="$green10">{t('quietHours.saveSuccess')}</Text> : null}

        <Button
          onPress={handleSave}
          disabled={mutation.isPending}
          aria-label={t('quietHours.save')}
        >
          {mutation.isPending ? t('quietHours.saving') : t('quietHours.save')}
        </Button>
      </YStack>
    </Card>
  );
}
