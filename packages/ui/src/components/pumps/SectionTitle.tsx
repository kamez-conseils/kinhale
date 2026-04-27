import * as React from 'react';
import { Text, XStack } from 'tamagui';

export interface SectionTitleProps {
  children: React.ReactNode;
  count?: number;
}

export function SectionTitle({ children, count }: SectionTitleProps): React.JSX.Element {
  return (
    <XStack alignItems="baseline" gap={8} marginTop={8} marginBottom={10}>
      <Text
        tag="h2"
        margin={0}
        fontSize={11}
        color="$colorMore"
        textTransform="uppercase"
        letterSpacing={0.88}
        fontWeight="600"
      >
        {children}
      </Text>
      {count != null && (
        <Text fontSize={11} color="$colorFaint" fontWeight="500">
          · {count}
        </Text>
      )}
    </XStack>
  );
}
