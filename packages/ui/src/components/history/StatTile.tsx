import * as React from 'react';
import { Stack, Text, YStack } from 'tamagui';

export type StatTone = 'maint' | 'ok' | 'rescue';

export interface StatTileProps {
  label: string;
  /** Valeur principale, déjà formatée (ex. `"91"`). */
  value: string;
  /** Suffixe court (ex. `"%"`, `"j"`). */
  suffix?: string;
  tone?: StatTone;
}

const TONE: Record<StatTone, { bg: string; fg: string }> = {
  maint: { bg: '$maintSoft', fg: '$maintInk' },
  ok: { bg: '$okSoft', fg: '$okInk' },
  rescue: { bg: '$rescueSoft', fg: '$rescueInk' },
};

export function StatTile({
  label,
  value,
  suffix,
  tone = 'maint',
}: StatTileProps): React.JSX.Element {
  const tk = TONE[tone];
  return (
    <YStack
      flex={1}
      padding={14}
      borderRadius={14}
      backgroundColor={tk.bg as never}
      borderWidth={0.5}
      borderColor="$borderColor"
    >
      <Text
        fontSize={10}
        color={tk.fg as never}
        textTransform="uppercase"
        letterSpacing={0.8}
        fontWeight="600"
        opacity={0.8}
      >
        {label}
      </Text>
      <Stack flexDirection="row" alignItems="baseline" marginTop={4}>
        <Text
          fontFamily="$heading"
          fontSize={26}
          fontWeight="500"
          color={tk.fg as never}
          letterSpacing={-0.52}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Text>
        {suffix !== undefined && suffix !== '' && (
          <Text fontSize={14} marginLeft={4} color={tk.fg as never} opacity={0.7}>
            {suffix}
          </Text>
        )}
      </Stack>
    </YStack>
  );
}
