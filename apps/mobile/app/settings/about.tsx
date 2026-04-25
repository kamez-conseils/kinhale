import React, { type JSX } from 'react';
import { Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, H1, H2, Text, Button, Card } from 'tamagui';
import { DisclaimerBanner } from '../../src/components/DisclaimerFooter';

/**
 * Écran « Paramètres → À propos » mobile — KIN-088, E9-S05, RM27.
 *
 * Symétrique de `apps/web/src/app/settings/about/page.tsx` :
 * - DisclaimerBanner (texte complet RM27),
 * - version applicative (`EXPO_PUBLIC_APP_VERSION` avec fallback),
 * - mention licence AGPL v3 + lien web vers le texte de licence,
 * - éditeur Kamez Conseils + adresse RPRP `privacy@kinhale.health`,
 * - lien vers la politique de confidentialité (placeholder en v1.0).
 *
 * Aucune chaîne hardcodée, aucune recommandation médicale (RM8 + RM27),
 * aucune donnée santé.
 */
const APP_VERSION = process.env['EXPO_PUBLIC_APP_VERSION'] ?? 'v1.0.0-preview';
const LICENSE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';
const SOURCE_URL = 'https://github.com/kamez/kinhale';
// TODO(KIN-???): remplacer par la page statique dédiée mineurs lorsque
// disponible. Pour l'instant on renvoie vers privacy@kinhale.health.
const PRIVACY_POLICY_URL = 'https://kinhale.health/legal/privacy';

export default function SettingsAboutScreen(): JSX.Element {
  const { t } = useTranslation('common');

  const openExternal = (url: string): void => {
    void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('settingsAbout.heading')}</H1>
      <Text fontSize="$3" color="$color11">
        {t('settingsAbout.description')}
      </Text>

      <DisclaimerBanner />

      <Card padded bordered>
        <YStack gap="$3">
          <H2>{t('settingsAbout.title')}</H2>

          <XStack justifyContent="space-between" gap="$3" flexWrap="wrap">
            <Text fontWeight="600">{t('settingsAbout.versionLabel')}</Text>
            <Text testID="settings-about-version" selectable>
              {APP_VERSION}
            </Text>
          </XStack>

          <XStack justifyContent="space-between" gap="$3" flexWrap="wrap">
            <Text fontWeight="600">{t('settingsAbout.licenseLabel')}</Text>
            <Text>{t('settingsAbout.licenseValue')}</Text>
          </XStack>

          <Button
            onPress={() => openExternal(LICENSE_URL)}
            accessibilityRole="link"
            accessibilityLabel={t('settingsAbout.licenseLink')}
            theme="alt2"
          >
            {t('settingsAbout.licenseLink')}
          </Button>

          <Button
            onPress={() => openExternal(SOURCE_URL)}
            accessibilityRole="link"
            accessibilityLabel={t('settingsAbout.sourceLink')}
            theme="alt2"
          >
            {t('settingsAbout.sourceLink')}
          </Button>

          <XStack justifyContent="space-between" gap="$3" flexWrap="wrap">
            <Text fontWeight="600">{t('settingsAbout.publisherLabel')}</Text>
            <Text>{t('settingsAbout.publisherValue')}</Text>
          </XStack>

          <XStack justifyContent="space-between" gap="$3" flexWrap="wrap">
            <Text fontWeight="600">{t('settingsAbout.contactLabel')}</Text>
            <Text selectable>{t('settingsAbout.contactValue')}</Text>
          </XStack>
        </YStack>
      </Card>

      <Card padded bordered>
        <YStack gap="$2">
          <H2>{t('settingsAbout.privacyPolicy')}</H2>
          <Text fontSize="$2" color="$color11">
            {t('settingsAbout.privacyPolicyDescription')}
          </Text>
          <Button
            onPress={() => openExternal(PRIVACY_POLICY_URL)}
            accessibilityRole="link"
            accessibilityLabel={t('settingsAbout.privacyPolicy')}
          >
            {t('settingsAbout.privacyPolicy')}
          </Button>
        </YStack>
      </Card>
    </YStack>
  );
}
