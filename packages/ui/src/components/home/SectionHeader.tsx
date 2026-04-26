import * as React from 'react';
import { Text, XStack } from 'tamagui';

interface SectionHeaderProps {
  label: string;
  action?: React.ReactNode;
}

export function SectionHeader({ label, action }: SectionHeaderProps): React.JSX.Element {
  return (
    <XStack alignItems="center" justifyContent="space-between" marginBottom="$2.5">
      <Text
        tag="h2"
        margin={0}
        fontSize={11}
        fontWeight="600"
        color="$colorMore"
        textTransform="uppercase"
        letterSpacing="0.08em"
      >
        {label}
      </Text>
      {action}
    </XStack>
  );
}
