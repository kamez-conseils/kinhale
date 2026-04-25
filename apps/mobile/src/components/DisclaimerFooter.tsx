import React from 'react';
import { useTranslation } from 'react-i18next';
import { YStack, Text } from 'tamagui';

/**
 * Composants disclaimer non-dispositif-médical (RM27) — version mobile.
 *
 * Symétrique de `apps/web/src/components/DisclaimerFooter.tsx`. La
 * duplication est volontaire : pas de package `@kinhale/ui` partagé en
 * v1.0 (cf. CLAUDE.md). Les deux versions consomment les mêmes clés i18n
 * (`disclaimer.full` / `disclaimer.short`) — le texte reste la source de
 * vérité unique.
 *
 * Accessibilité native : `accessibilityRole="text"` (équivalent rôle
 * informatif) + `accessibilityLabel` i18n.
 *
 * Refs: KIN-088 / E9-S05 / RM27.
 */

export interface DisclaimerFooterProps {
  readonly accessibilityLabel?: string;
}

export function DisclaimerFooter({ accessibilityLabel }: DisclaimerFooterProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const label = accessibilityLabel ?? t('disclaimer.ariaLabel');
  return (
    <Text
      testID="disclaimer-footer-short"
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      fontSize="$2"
      color="$color11"
      textAlign="center"
      paddingVertical="$2"
      paddingHorizontal="$3"
    >
      {t('disclaimer.short')}
    </Text>
  );
}

export function DisclaimerBanner({ accessibilityLabel }: DisclaimerFooterProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const label = accessibilityLabel ?? t('disclaimer.ariaLabel');
  return (
    <YStack
      testID="disclaimer-banner-full"
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      backgroundColor="$backgroundStrong"
      borderColor="$borderColor"
      borderWidth={1}
      borderRadius="$3"
      padding="$3"
    >
      <Text fontSize="$3" color="$color12" lineHeight="$3">
        {t('disclaimer.full')}
      </Text>
    </YStack>
  );
}
