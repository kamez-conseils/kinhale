import * as React from 'react';
import { Button, Input, Stack, Text, XStack, YStack } from 'tamagui';

import { EnvelopeIcon, LockIcon, SpinnerIcon } from './icons';
import type { AuthCopy } from './types';

interface EmailFormProps {
  copy: Pick<
    AuthCopy,
    'emailLabel' | 'emailPlaceholder' | 'sendBtn' | 'sendingBtn' | 'invalidEmail' | 'secure'
  >;
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  errorMessage?: string | null;
  autoFocus?: boolean;
}

const EMAIL_RE = /\S+@\S+\.\S+/;

export function EmailForm({
  copy,
  value,
  onChange,
  onSubmit,
  submitting,
  errorMessage = null,
  autoFocus = false,
}: EmailFormProps): React.JSX.Element {
  const trimmed = value.trim();
  const valid = EMAIL_RE.test(trimmed);
  const showFormatError = trimmed.length > 0 && !valid;
  const disabled = !valid || submitting;

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>): void => {
    e?.preventDefault?.();
    if (disabled) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <YStack gap={8}>
        <Text
          fontSize={11}
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing={0.08 * 11}
          fontWeight="600"
          tag="label"
          htmlFor="kinhale-auth-email"
        >
          {copy.emailLabel}
        </Text>
        <XStack
          alignItems="center"
          backgroundColor="$surface"
          borderRadius={14}
          borderWidth={1}
          borderColor={showFormatError ? '$amber' : '$borderColorStrong'}
          animation="quick"
        >
          <Stack paddingLeft={14}>
            <EnvelopeIcon size={18} color="var(--colorMore, currentColor)" />
          </Stack>
          <Input
            id="kinhale-auth-email"
            unstyled
            flex={1}
            paddingHorizontal={10}
            paddingVertical={14}
            fontSize={15}
            color="$color"
            placeholderTextColor="$colorFaint"
            value={value}
            onChangeText={onChange}
            placeholder={copy.emailPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            spellCheck={false}
            autoFocus={autoFocus}
            aria-label={copy.emailLabel}
            aria-invalid={showFormatError}
            aria-describedby={
              showFormatError || errorMessage ? 'kinhale-auth-email-error' : undefined
            }
          />
        </XStack>
        {(showFormatError || errorMessage) && (
          <Text
            id="kinhale-auth-email-error"
            role="alert"
            fontSize={12}
            color="$amberInk"
            marginTop={2}
          >
            {errorMessage ?? copy.invalidEmail}
          </Text>
        )}
      </YStack>

      <Button
        disabled={disabled}
        onPress={() => handleSubmit()}
        backgroundColor={disabled ? '$borderColorStrong' : '$maint'}
        color="white"
        borderRadius={14}
        paddingHorizontal={18}
        paddingVertical={15}
        fontSize={15}
        fontWeight="600"
        pressStyle={{ opacity: 0.85 }}
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: submitting }}
        icon={
          submitting ? (
            <SpinnerIcon size={18} color="#fff" />
          ) : (
            <EnvelopeIcon size={18} color="#fff" />
          )
        }
      >
        {submitting ? copy.sendingBtn : copy.sendBtn}
      </Button>

      <XStack
        alignItems="center"
        justifyContent="center"
        gap={6}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <LockIcon size={11} color="var(--colorFaint, currentColor)" />
        <Text fontSize={11} color="$colorFaint">
          {copy.secure}
        </Text>
      </XStack>
    </form>
  );
}
