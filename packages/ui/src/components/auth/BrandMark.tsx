import * as React from 'react';
import { Text, XStack } from 'tamagui';

interface BrandMarkProps {
  size?: 'md' | 'lg';
  accent?: string;
}

// Logo simplifié : un disque accentué + le mot-marque "kinhale" en bas-de-casse.
// Choisi minimal pour rester crédible sur fond clair comme sur fond marqué.
export function BrandMark({ size = 'md', accent = '$maint' }: BrandMarkProps): React.JSX.Element {
  const dotSize = size === 'lg' ? 20 : 14;
  const fontSize = size === 'lg' ? 22 : 17;
  return (
    <XStack alignItems="center" gap={8} accessibilityRole="header" accessibilityLabel="Kinhale">
      <Text
        width={dotSize}
        height={dotSize}
        borderRadius={dotSize}
        backgroundColor={accent}
        fontSize={0}
      />
      <Text
        fontSize={fontSize}
        fontWeight="600"
        letterSpacing={-0.4}
        color="$color"
        fontFamily="$body"
      >
        kinhale
      </Text>
    </XStack>
  );
}
