'use client'
import { useTranslation } from 'react-i18next'
import { YStack, H1, Text } from 'tamagui'

export default function HomePage() {
  const { t } = useTranslation('common')
  return (
    <YStack padding="$4" gap="$4" alignItems="center" justifyContent="center" flex={1}>
      <H1>{t('home.title')}</H1>
      <Text fontSize="$5" textAlign="center">{t('home.subtitle')}</Text>
    </YStack>
  )
}
