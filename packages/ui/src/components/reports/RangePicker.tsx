import * as React from 'react';
import { Stack, Text, XStack } from 'tamagui';

import { CalendarIcon } from './icons';
import type { RangePreset, ReportRangeOption } from './types';

export interface RangePickerProps {
  /** Libellé court « Période ». */
  label: string;
  options: ReadonlyArray<ReportRangeOption>;
  active: RangePreset;
  /** Plage sélectionnée formatée (ex. « Du 27 janv. au 26 avril ». */
  selectedRangeLabel: string;
  mode?: 'mobile' | 'web';
  onChange?: ((next: RangePreset) => void) | undefined;
}

export function RangePicker({
  label,
  options,
  active,
  selectedRangeLabel,
  mode = 'web',
  onChange,
}: RangePickerProps): React.JSX.Element {
  return (
    <XStack
      backgroundColor="$surface"
      borderRadius={14}
      borderWidth={0.5}
      borderColor="$borderColor"
      paddingHorizontal={mode === 'web' ? 14 : 12}
      paddingVertical={12}
      alignItems="center"
      gap={10}
      flexWrap="wrap"
    >
      <XStack alignItems="center" gap={6}>
        <Text color="$colorMuted" display="flex" alignItems="center" justifyContent="center">
          <CalendarIcon size={13} color="currentColor" />
        </Text>
        <Text fontSize={12} fontWeight="600" color="$colorMuted">
          {label}
        </Text>
      </XStack>

      <XStack gap={4} padding={3} backgroundColor="$surface2" borderRadius={99} flexWrap="wrap">
        {options.map((opt) => {
          const sel = opt.value === active;
          return (
            <Stack
              key={opt.value}
              tag="button"
              cursor="pointer"
              paddingHorizontal={11}
              paddingVertical={5}
              borderRadius={99}
              borderWidth={0}
              backgroundColor={sel ? '$surface' : 'transparent'}
              accessibilityRole="radio"
              accessibilityState={{ checked: sel }}
              accessibilityLabel={opt.label}
              {...(onChange ? { onPress: () => onChange(opt.value) } : {})}
              style={sel ? { boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : undefined}
            >
              <Text
                fontSize={11.5}
                fontWeight={sel ? '600' : '500'}
                color={sel ? '$color' : '$colorMore'}
              >
                {opt.label}
              </Text>
            </Stack>
          );
        })}
      </XStack>

      <Text
        fontFamily="$mono"
        fontSize={11.5}
        color="$colorMore"
        marginLeft="auto"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {selectedRangeLabel}
      </Text>
    </XStack>
  );
}
