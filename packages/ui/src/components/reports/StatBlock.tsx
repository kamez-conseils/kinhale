import * as React from 'react';
import { Text, XStack, YStack } from 'tamagui';

import type { StatTone } from './types';

const TONE_FG: Record<StatTone, string> = {
  ok: '$okInk',
  rescue: '$rescueInk',
  amber: '$amberInk',
  maint: '$maintInk',
};

export interface StatBlockProps {
  label: string;
  value: string;
  suffix?: string | undefined;
  sub: string;
  tone?: StatTone;
}

export function StatBlock({
  label,
  value,
  suffix,
  sub,
  tone = 'maint',
}: StatBlockProps): React.JSX.Element {
  const fg = TONE_FG[tone];
  return (
    <YStack
      flex={1}
      padding={16}
      borderRadius={14}
      backgroundColor="$surface"
      borderWidth={0.5}
      borderColor="$borderColor"
      gap={4}
    >
      <Text
        fontSize={10}
        color="$colorMore"
        textTransform="uppercase"
        letterSpacing={0.8}
        fontWeight="600"
      >
        {label}
      </Text>
      <XStack alignItems="baseline">
        <Text
          fontFamily="$heading"
          fontSize={30}
          fontWeight="500"
          color={fg as never}
          letterSpacing={-0.6}
          lineHeight={32}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Text>
        {suffix !== undefined && suffix !== '' && (
          <Text fontSize={14} marginLeft={4} color="$colorMore" fontWeight="400">
            {suffix}
          </Text>
        )}
      </XStack>
      <Text fontSize={11.5} color="$colorMore" marginTop={2}>
        {sub}
      </Text>
    </YStack>
  );
}
