import React, { type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, H1, H2, Text, Card } from 'tamagui';
import { listMyAuditEvents, type AuditEventListItem } from '../../src/lib/audit-events/client';

/**
 * Écran « Paramètres → Activité du foyer » mobile — KIN-093, E9-S09.
 *
 * Symétrique de `apps/web/src/app/settings/activity/page.tsx` :
 * - liste les 90 derniers événements d'audit du compte courant,
 * - aucune donnée santé (zero-knowledge),
 * - libellés i18n FR/EN, formatage date/heure selon locale.
 *
 * Refs: KIN-093, E9-S09, RM11.
 */

const KNOWN_EVENT_TYPES = new Set([
  'report_generated',
  'report_shared',
  'privacy_export',
  'account_deletion_requested',
  'account_deletion_cancelled',
  'account_deleted',
]);

function formatDateTime(ms: number, locale: 'fr' | 'en'): string {
  const formatter = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return formatter.format(new Date(ms));
}

export default function SettingsActivityScreen(): JSX.Element {
  const { t, i18n } = useTranslation('common');
  const [events, setEvents] = React.useState<ReadonlyArray<AuditEventListItem>>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const refresh = async (): Promise<void> => {
      try {
        const data = await listMyAuditEvents();
        if (!cancelled) {
          setEvents(data);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError(t('audit.page.loadError'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void refresh();
    return (): void => {
      cancelled = true;
    };
  }, [t]);

  const locale: 'fr' | 'en' = i18n.language?.toLowerCase().startsWith('en') ? 'en' : 'fr';

  return (
    <YStack padding="$4" gap="$4">
      <H1 accessibilityRole="header">{t('audit.page.title')}</H1>
      <Text fontSize="$3" color="$color11">
        {t('audit.page.subtitle')}
      </Text>

      {loading ? <Text accessibilityLiveRegion="polite">{t('common.loading')}</Text> : null}

      {error !== null ? (
        <Text color="$red10" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {!loading && error === null && events.length === 0 ? (
        <Card padded bordered>
          <Text>{t('audit.page.empty')}</Text>
        </Card>
      ) : null}

      {events.length > 0 ? (
        <YStack gap="$2">
          <H2>{t('audit.page.listHeading')}</H2>
          {events.map((event) => (
            <Card key={event.id} padded bordered>
              <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
                <YStack flex={1} gap="$1">
                  <Text fontWeight="600">
                    {KNOWN_EVENT_TYPES.has(event.eventType)
                      ? t(`audit.event.${event.eventType}`)
                      : t('audit.event.other')}
                  </Text>
                  <Text fontSize="$2" color="$color11">
                    {formatDateTime(event.createdAtMs, locale)}
                  </Text>
                </YStack>
              </XStack>
            </Card>
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}
