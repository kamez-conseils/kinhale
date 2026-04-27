import * as React from 'react';
import { Stack, Text, XStack } from 'tamagui';

import type { SettingsSegmentOption } from './types';

export interface SegmentedProps {
  options: ReadonlyArray<SettingsSegmentOption>;
  value: string;
  /** Libellé `aria-label` du group (déjà localisé). */
  ariaLabel: string;
  onChange?: ((next: string) => void) | undefined;
}

export function Segmented({
  options,
  value,
  ariaLabel,
  onChange,
}: SegmentedProps): React.JSX.Element {
  return (
    <XStack
      gap={3}
      padding={3}
      backgroundColor="$surface2"
      borderRadius={99}
      role="radiogroup"
      accessibilityLabel={ariaLabel}
    >
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Stack
            key={o.value}
            tag="button"
            cursor="pointer"
            paddingHorizontal={12}
            paddingVertical={5}
            borderRadius={99}
            borderWidth={0}
            backgroundColor={sel ? '$surface' : 'transparent'}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }}
            accessibilityLabel={o.label}
            {...(onChange ? { onPress: () => onChange(o.value) } : {})}
            style={sel ? { boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } : undefined}
          >
            <Text
              fontSize={11.5}
              fontWeight={sel ? '600' : '500'}
              color={sel ? '$maint' : '$colorMore'}
            >
              {o.label}
            </Text>
          </Stack>
        );
      })}
    </XStack>
  );
}
