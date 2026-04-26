import * as React from 'react';
import { Stack, Text, YStack } from 'tamagui';

import { SpinnerIcon } from './icons';
import type { AuthCopy } from './types';

interface SigningBlockProps {
  copy: Pick<AuthCopy, 'signingTitle' | 'signingSub'>;
  errorMessage?: string | null;
  retryCta?: { label: string; onPress: () => void } | null;
}

export function SigningBlock({
  copy,
  errorMessage = null,
  retryCta = null,
}: SigningBlockProps): React.JSX.Element {
  if (errorMessage !== null && retryCta) {
    return (
      <YStack alignItems="center" gap={18} paddingVertical={20}>
        <Stack
          width={56}
          height={56}
          borderRadius={16}
          backgroundColor="$amberSoft"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize={28} color="$amberInk" fontWeight="600">
            !
          </Text>
        </Stack>
        <YStack gap={6} alignItems="center">
          <Text
            fontSize={22}
            fontWeight="500"
            letterSpacing={-0.22}
            color="$color"
            textAlign="center"
            role="alert"
          >
            {errorMessage}
          </Text>
        </YStack>
        {/* CTA retry — bouton natif HTML pour rendu fiable côté web : touch
            target ≥ 44 pt (WCAG 2.5.5), focus visible, vrai role="button". */}
        <button
          type="button"
          onClick={retryCta.onPress}
          aria-label={retryCta.label}
          style={{
            appearance: 'none',
            border: '0.5px solid var(--borderColorStrong)',
            background: 'transparent',
            borderRadius: 12,
            minHeight: 44,
            minWidth: 44,
            padding: '12px 18px',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            color: 'var(--maint)',
          }}
        >
          {retryCta.label}
        </button>
      </YStack>
    );
  }

  return (
    <YStack alignItems="center" gap={18} paddingVertical={20} accessibilityLiveRegion="polite">
      <Stack
        width={56}
        height={56}
        borderRadius={16}
        backgroundColor="$maintSoft"
        alignItems="center"
        justifyContent="center"
      >
        <SpinnerIcon size={28} color="var(--maint, currentColor)" />
      </Stack>
      <YStack gap={6} alignItems="center">
        <Text fontSize={22} fontWeight="500" letterSpacing={-0.22} color="$color">
          {copy.signingTitle}
        </Text>
        <Text fontSize={14} color="$colorMore">
          {copy.signingSub}
        </Text>
      </YStack>
    </YStack>
  );
}
