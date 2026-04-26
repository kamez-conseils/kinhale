import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import type { CaregiverRole } from './types';

interface KinhaleHeaderProps {
  dateLabel: string;
  childName: string;
  roleLabel: string;
  role: CaregiverRole;
}

export function KinhaleHeader({
  dateLabel,
  childName,
  roleLabel,
}: KinhaleHeaderProps): React.JSX.Element {
  return (
    <XStack
      paddingHorizontal="$4"
      paddingTop="$5"
      paddingBottom="$3"
      alignItems="flex-end"
      justifyContent="space-between"
      gap="$3"
    >
      <YStack flexShrink={1} minWidth={0}>
        <Text
          fontSize={11}
          fontWeight="600"
          color="$colorMore"
          textTransform="uppercase"
          letterSpacing="0.1em"
        >
          {dateLabel}
        </Text>
        <Text
          fontSize={28}
          lineHeight={32}
          marginTop={4}
          fontWeight="500"
          color="$color"
          letterSpacing="-0.02em"
        >
          {childName}
        </Text>
      </YStack>

      <XStack
        alignItems="center"
        gap="$2"
        paddingVertical="$1"
        paddingHorizontal="$2.5"
        backgroundColor="$surface2"
        borderRadius={9999}
        borderWidth={0.5}
        borderColor="$borderColor"
      >
        <Stack
          width={6}
          height={6}
          borderRadius={9999}
          backgroundColor="$ok"
          shadowColor="$okSoft"
          shadowRadius={0}
          shadowOffset={{ width: 0, height: 0 }}
          // 3px ring around dot — emulated via wrapping ring below
        />
        <Text fontSize={11} color="$colorMore" fontWeight="500">
          {roleLabel}
        </Text>
      </XStack>
    </XStack>
  );
}
