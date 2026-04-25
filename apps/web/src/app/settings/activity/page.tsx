'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { YStack, XStack, H1, H2, Text, Card } from 'tamagui';
import { listMyAuditEvents, type AuditEventListItem } from '../../../lib/audit-events/client';
import { useRequireAuth } from '../../../lib/useRequireAuth';

/**
 * Écran « Paramètres → Activité du foyer » — KIN-093, E9-S09.
 *
 * Affiche les 90 derniers événements d'audit du compte courant :
 * - génération / partage de rapport médecin (KIN-083, KIN-084),
 * - export RGPD/Loi 25 (KIN-085),
 * - cycle de suppression de compte (KIN-086).
 *
 * **Zero-knowledge** : aucune donnée santé n'est jamais affichée — la table
 * `audit_events` côté serveur ne stocke que des hashes opaques, des
 * timestamps et des enums. La whitelist `event_data` est appliquée à
 * deux niveaux (serveur + UI fallback : libellé "autre" pour un type futur).
 *
 * Refs: KIN-093, E9-S09, RM11.
 */

const QUERY_KEY = ['audit-events', 'me'] as const;

const KNOWN_EVENT_TYPES = new Set([
  'report_generated',
  'report_shared',
  'privacy_export',
  'account_deletion_requested',
  'account_deletion_cancelled',
  'account_deleted',
]);

/**
 * Liste de paires fixes [clé i18n datetime, locale i18next]. La détection de
 * locale s'aligne sur le pattern de `apps/web/src/app/settings/privacy/page.tsx`
 * qui lit `home.title` (équivalent visible aussi côté mobile). Pas
 * d'`Intl.DateTimeFormat` calé sur navigator.language pour rester strictement
 * cohérent avec la locale i18next sélectionnée.
 */
function formatDateTime(ms: number, locale: 'fr' | 'en'): string {
  // ICU full Intl avec locale forcée (Node 20 / navigateurs modernes ont
  // toutes les locales). Format : date courte + heure courte.
  const formatter = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return formatter.format(new Date(ms));
}

export default function SettingsActivityPage(): React.JSX.Element | null {
  const { t, i18n } = useTranslation('common');
  const authenticated = useRequireAuth();

  const { data, error, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: listMyAuditEvents,
    enabled: authenticated,
  });

  if (!authenticated) return null;

  // Détecte la locale i18n active (FR par défaut, EN sinon). i18n.language
  // peut être `fr-FR`, `en-US`, etc. — on garde uniquement la base.
  const locale: 'fr' | 'en' = i18n.language?.toLowerCase().startsWith('en') ? 'en' : 'fr';

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('audit.page.title')}</H1>
      <Text fontSize="$3" color="$color11">
        {t('audit.page.subtitle')}
      </Text>

      {isLoading ? <Text accessibilityLiveRegion="polite">{t('common.loading')}</Text> : null}

      {error !== null && error !== undefined ? (
        <Text color="$red10" accessibilityLiveRegion="polite">
          {t('audit.page.loadError')}
        </Text>
      ) : null}

      {!isLoading && data !== undefined && data.length === 0 ? (
        <Card padded bordered>
          <Text>{t('audit.page.empty')}</Text>
        </Card>
      ) : null}

      {data !== undefined && data.length > 0 ? (
        <YStack gap="$2">
          <H2>{t('audit.page.listHeading')}</H2>
          {data.map((event: AuditEventListItem) => (
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
