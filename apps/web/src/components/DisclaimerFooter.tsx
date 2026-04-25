'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { YStack, Text } from 'tamagui';

/**
 * Composants disclaimer non-dispositif-médical (RM27).
 *
 * Deux variantes :
 * - {@link DisclaimerFooter} : version discrète d'une ligne pour les pieds
 *   d'écran (E1 auth, E4 saisie, étapes E10 onboarding).
 * - {@link DisclaimerBanner} : version complète à intégrer en haut de
 *   l'onboarding (écran 1) et dans Settings → À propos.
 *
 * Source de vérité texte : `disclaimer.full` / `disclaimer.short` dans
 * `packages/i18n/src/locales/{fr,en}/common.json`. Aucune chaîne hardcodée.
 *
 * Accessibilité : rôle ARIA `note`, `aria-label` i18n explicite, contraste
 * WCAG AA via tokens Tamagui (`$color11` sur fond), taille minimale 12 px
 * pour `short`, 14 px pour `full`.
 *
 * Refs: KIN-088 / E9-S05 / RM27.
 */

export interface DisclaimerFooterProps {
  /** Override du label vocal (sinon `disclaimer.ariaLabel`). */
  readonly accessibilityLabel?: string;
}

/**
 * Disclaimer discret (une ligne) à placer en pied d'écran.
 */
export function DisclaimerFooter({ accessibilityLabel }: DisclaimerFooterProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const label = accessibilityLabel ?? t('disclaimer.ariaLabel');
  return (
    <Text
      testID="disclaimer-footer-short"
      role="note"
      aria-label={label}
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

/**
 * Disclaimer complet (bandeau) — onboarding écran 1 et Settings → À propos.
 */
export function DisclaimerBanner({ accessibilityLabel }: DisclaimerFooterProps): React.JSX.Element {
  const { t } = useTranslation('common');
  const label = accessibilityLabel ?? t('disclaimer.ariaLabel');
  return (
    <YStack
      testID="disclaimer-banner-full"
      role="note"
      aria-label={label}
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
