'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Input, Button, Text } from 'tamagui';
import { apiFetch } from '../../lib/api-client';
import { DisclaimerFooter } from '../../components/DisclaimerFooter';

export default function AuthPage(): React.JSX.Element {
  const { t } = useTranslation('common');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError(t('auth.errorSend'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <YStack padding="$4" gap="$4" alignItems="center" justifyContent="center" flex={1}>
        <Text fontSize="$5">{t('auth.linkSent')}</Text>
        <DisclaimerFooter />
      </YStack>
    );
  }

  return (
    <YStack padding="$4" gap="$4" alignItems="center" justifyContent="center" flex={1}>
      <H1>{t('auth.title')}</H1>
      <Input
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        width="100%"
        maxWidth={400}
        accessibilityLabel={t('auth.emailPlaceholder')}
      />
      {error !== null && (
        <Text color="$red10" role="alert">
          {error}
        </Text>
      )}
      <Button
        onPress={() => void handleSubmit()}
        disabled={loading || email.length === 0}
        width="100%"
        maxWidth={400}
      >
        {loading ? t('common.loading') : t('auth.submit')}
      </Button>
      {/* Pied E1 auth : disclaimer discret RM27. */}
      <DisclaimerFooter />
    </YStack>
  );
}
