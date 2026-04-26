import * as React from 'react';
import { YStack, type YStackProps } from 'tamagui';

/** Card-style section container used across the Home dashboard. */
export function Section(props: YStackProps): React.JSX.Element {
  return (
    <YStack
      backgroundColor="$surface"
      borderRadius={20}
      padding="$4"
      borderWidth={0.5}
      borderColor="$borderColor"
      {...props}
    />
  );
}
