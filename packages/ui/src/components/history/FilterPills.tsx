import * as React from 'react';
import { Stack, Text, XStack } from 'tamagui';

import type { HistoryFilter } from './types';

export interface FilterPillsProps {
  active: HistoryFilter;
  labelAll: string;
  labelMaint: string;
  labelRescue: string;
  /** Si vrai, occupe toute la largeur (mobile) ; sinon `width: fit-content` (desktop). */
  fullWidth?: boolean;
  onChange?: ((f: HistoryFilter) => void) | undefined;
}

export function FilterPills({
  active,
  labelAll,
  labelMaint,
  labelRescue,
  fullWidth = false,
  onChange,
}: FilterPillsProps): React.JSX.Element {
  const items: ReadonlyArray<{ value: HistoryFilter; label: string }> = [
    { value: 'all', label: labelAll },
    { value: 'maint', label: labelMaint },
    { value: 'rescue', label: labelRescue },
  ];
  return (
    <XStack
      gap={6}
      padding={4}
      backgroundColor="$surface2"
      borderRadius={99}
      width={fullWidth ? '100%' : 'fit-content'}
      role="radiogroup"
    >
      {items.map((it) => {
        const isActive = it.value === active;
        return (
          <Stack
            key={it.value}
            tag="button"
            cursor="pointer"
            paddingHorizontal={fullWidth ? 10 : 14}
            paddingVertical={fullWidth ? 8 : 7}
            borderRadius={99}
            borderWidth={0}
            backgroundColor={isActive ? '$surface' : 'transparent'}
            flex={fullWidth ? 1 : 0}
            alignItems="center"
            justifyContent="center"
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
            accessibilityLabel={it.label}
            {...(onChange ? { onPress: () => onChange(it.value) } : {})}
            style={isActive ? { boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : undefined}
          >
            <Text
              fontSize={fullWidth ? 12 : 12.5}
              fontWeight={isActive ? '600' : '500'}
              color={isActive ? '$color' : '$colorMore'}
            >
              {it.label}
            </Text>
          </Stack>
        );
      })}
    </XStack>
  );
}
