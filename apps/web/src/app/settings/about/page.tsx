'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, H1, H2, Text, Card, Anchor } from 'tamagui';
import { DisclaimerBanner } from '../../../components/DisclaimerFooter';

/**
 * Écran « Paramètres → À propos » — KIN-088, E9-S05, RM27.
 *
 * Affiche :
 * - le disclaimer complet (DisclaimerBanner) — version RM27 source de vérité,
 * - la version applicative lue depuis `NEXT_PUBLIC_APP_VERSION`
 *   (avec fallback `v1.0.0-preview`),
 * - la mention licence AGPL v3 + lien vers le texte de licence,
 * - l'éditeur Kamez Conseils + l'adresse RPRP `privacy@kinhale.health`,
 * - le lien vers la politique de confidentialité (placeholder local en
 *   v1.0 — à remplacer par la page statique dédiée mineurs cf. KIN-???).
 *
 * Cet écran NE contient :
 * - aucune chaîne hardcodée (toutes les libellés via i18n),
 * - aucune recommandation médicale (RM8 + RM27),
 * - aucune donnée santé (page statique).
 */
const APP_VERSION = process.env['NEXT_PUBLIC_APP_VERSION'] ?? 'v1.0.0-preview';
const LICENSE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';
const SOURCE_URL = 'https://github.com/kamez/kinhale';
// TODO(KIN-???): remplacer par la page statique dédiée mineurs lorsque
// disponible. Pour l'instant on renvoie vers privacy@kinhale.health.
const PRIVACY_POLICY_URL = '/legal/privacy';

export default function SettingsAboutPage(): React.JSX.Element {
  const { t } = useTranslation('common');

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

          <Anchor
            href={LICENSE_URL}
            target="_blank"
            rel="noreferrer noopener"
            color="$blue11"
            textDecorationLine="underline"
          >
            {t('settingsAbout.licenseLink')}
          </Anchor>

          <XStack justifyContent="space-between" gap="$3" flexWrap="wrap">
            <Text fontWeight="600">{t('settingsAbout.sourceLabel')}</Text>
            <Anchor
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer noopener"
              color="$blue11"
              textDecorationLine="underline"
            >
              {t('settingsAbout.sourceLink')}
            </Anchor>
          </XStack>

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
          <Anchor href={PRIVACY_POLICY_URL} color="$blue11" textDecorationLine="underline">
            {t('settingsAbout.privacyPolicy')}
          </Anchor>
        </YStack>
      </Card>
    </YStack>
  );
}
