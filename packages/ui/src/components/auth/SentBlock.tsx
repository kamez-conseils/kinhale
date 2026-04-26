import * as React from 'react';
import { Button, Stack, Text, XStack, YStack } from 'tamagui';

import { CheckSmallIcon, EnvelopeIcon, EnvelopeOpenIcon } from './icons';
import type { AuthCopy } from './types';

interface SentBlockProps {
  copy: Pick<
    AuthCopy,
    | 'sentTitle'
    | 'sentSubLine1'
    | 'sentSubLine2'
    | 'openMail'
    | 'didntGet'
    | 'resend'
    | 'resendIn'
    | 'changeEmail'
  >;
  email: string;
  resendIn: number;
  onResend: () => void;
  onChangeEmail: () => void;
  onOpenMail?: () => void;
  layout?: 'mobile' | 'web';
}

export function SentBlock({
  copy,
  email,
  resendIn,
  onResend,
  onChangeEmail,
  onOpenMail,
  layout = 'mobile',
}: SentBlockProps): React.JSX.Element {
  const align = layout === 'web' ? 'flex-start' : 'center';
  const titleSize = layout === 'web' ? 30 : 24;

  return (
    <YStack gap={16} alignItems={align}>
      <Stack
        width={56}
        height={56}
        borderRadius={16}
        backgroundColor="$maintSoft"
        alignItems="center"
        justifyContent="center"
        position="relative"
      >
        <EnvelopeOpenIcon size={28} color="var(--maint, currentColor)" />
        <Stack
          position="absolute"
          bottom={-6}
          right={-6}
          width={22}
          height={22}
          borderRadius={11}
          backgroundColor="$ok"
          alignItems="center"
          justifyContent="center"
          borderWidth={2.5}
          borderColor="$background"
        >
          <CheckSmallIcon size={11} color="#ffffff" />
        </Stack>
      </Stack>

      <YStack gap={6} alignItems={align}>
        <Text
          fontSize={titleSize}
          fontWeight="500"
          letterSpacing={-0.4}
          color="$color"
          lineHeight={titleSize * 1.15}
        >
          {copy.sentTitle}
        </Text>
        <Text
          fontSize={14}
          color="$colorMuted"
          lineHeight={21}
          textAlign={layout === 'web' ? 'left' : 'center'}
        >
          {copy.sentSubLine1}{' '}
          <Text
            fontSize={13}
            color="$color"
            backgroundColor="$surface2"
            borderWidth={0.5}
            borderColor="$borderColor"
            borderRadius={8}
            paddingHorizontal={10}
            paddingVertical={2}
            fontFamily="$body"
          >
            {email}
          </Text>{' '}
          · {copy.sentSubLine2}
        </Text>
      </YStack>

      {onOpenMail && (
        <Button
          onPress={onOpenMail}
          backgroundColor="$surface"
          color="$color"
          borderColor="$borderColorStrong"
          borderWidth={0.5}
          borderRadius={12}
          paddingHorizontal={18}
          paddingVertical={12}
          fontSize={14}
          fontWeight="500"
          icon={<EnvelopeIcon size={16} color="var(--colorMuted, currentColor)" />}
          pressStyle={{ opacity: 0.85 }}
          accessibilityRole="button"
          accessibilityLabel={copy.openMail}
          testID="auth-open-mail"
        >
          {copy.openMail}
        </Button>
      )}

      <YStack
        backgroundColor="$surface"
        borderRadius={12}
        borderWidth={0.5}
        borderColor="$borderColor"
        paddingVertical={14}
        paddingHorizontal={16}
        gap={4}
        width="100%"
      >
        <Text fontSize={12} color="$colorMore">
          {copy.didntGet}
        </Text>
        <XStack alignItems="center" justifyContent="space-between" gap={12}>
          <button
            type="button"
            data-testid="auth-resend"
            disabled={resendIn > 0}
            onClick={onResend}
            aria-label={resendIn > 0 ? copy.resendIn({ n: resendIn }) : copy.resend}
            style={{
              appearance: 'none',
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 500,
              cursor: resendIn > 0 ? 'default' : 'pointer',
              color: resendIn > 0 ? 'var(--colorFaint)' : 'var(--maint)',
            }}
          >
            {resendIn > 0 ? copy.resendIn({ n: resendIn }) : copy.resend}
          </button>
          <Stack width={1} height={14} backgroundColor="$borderColor" />
          <button
            type="button"
            data-testid="auth-change-email"
            onClick={onChangeEmail}
            aria-label={copy.changeEmail}
            style={{
              appearance: 'none',
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              color: 'var(--colorMuted)',
            }}
          >
            {copy.changeEmail}
          </button>
        </XStack>
      </YStack>
    </YStack>
  );
}
