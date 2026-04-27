import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { BrandIcon } from '../auth/icons';
import type { SettingsNavItem } from './types';

export interface SettingsSidebarProps {
  navItems: ReadonlyArray<SettingsNavItem>;
  brandLabel?: string;
}

export function SettingsSidebar({
  navItems,
  brandLabel = 'Kinhale',
}: SettingsSidebarProps): React.JSX.Element {
  return (
    <YStack
      tag="aside"
      borderRightWidth={0.5}
      borderRightColor="$borderColor"
      paddingHorizontal={14}
      paddingVertical={20}
      gap={4}
      backgroundColor="$surface"
      style={{ overflow: 'auto' }}
    >
      <XStack alignItems="center" gap={10} paddingHorizontal={8} paddingTop={4} paddingBottom={18}>
        <Stack
          width={28}
          height={28}
          borderRadius={8}
          backgroundColor="$maint"
          alignItems="center"
          justifyContent="center"
        >
          <BrandIcon size={15} color="#ffffff" />
        </Stack>
        <Text
          fontFamily="$heading"
          fontSize={17}
          fontWeight="600"
          letterSpacing={-0.17}
          color="$color"
        >
          {brandLabel}
        </Text>
      </XStack>

      {navItems.map((item) => (
        <XStack
          key={item.key}
          tag="button"
          paddingHorizontal={10}
          paddingVertical={9}
          borderRadius={8}
          backgroundColor={item.active ? '$surface2' : 'transparent'}
          cursor="pointer"
          alignItems="center"
          gap={10}
          borderWidth={0}
          hoverStyle={{ backgroundColor: '$surface2' }}
          {...(item.onPress ? { onPress: item.onPress } : {})}
          accessibilityRole="link"
          accessibilityLabel={item.label}
        >
          <Stack
            width={6}
            height={6}
            borderRadius={3}
            backgroundColor={item.active ? '$maint' : '$borderColorStrong'}
          />
          <Text
            fontSize={13.5}
            fontWeight={item.active ? '600' : '500'}
            color={item.active ? '$color' : '$colorMuted'}
            fontFamily="$body"
          >
            {item.label}
          </Text>
        </XStack>
      ))}
    </YStack>
  );
}
