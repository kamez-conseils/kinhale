import * as React from 'react';
import { Text, XStack, YStack } from 'tamagui';

import type { AuthCopy } from './types';

interface LegalFooterProps {
  copy: Pick<AuthCopy, 'legal' | 'notMedical'>;
  layout?: 'mobile' | 'web';
}

// Pied légal présent sur tous les états — disclaimer médical RM27 toujours
// visible et intégré au flux normal (pas modal, pas masquable). Sur web on
// distingue le disclaimer (italique, gauche) de la mention légale (droite).
export function LegalFooter({ copy, layout = 'mobile' }: LegalFooterProps): React.JSX.Element {
  if (layout === 'web') {
    return (
      <XStack justifyContent="space-between" alignItems="center" gap={12}>
        <Text
          fontSize={11}
          color="$colorFaint"
          fontStyle="italic"
          accessibilityLabel={copy.notMedical}
          flexShrink={0}
        >
          {copy.notMedical}
        </Text>
        <Text fontSize={11} color="$colorFaint" textAlign="right" maxWidth={320}>
          {copy.legal}
        </Text>
      </XStack>
    );
  }
  return (
    <YStack alignItems="center" gap={8} paddingTop={16}>
      <Text fontSize={11} color="$colorFaint" textAlign="center" lineHeight={16} maxWidth={280}>
        {copy.legal}
      </Text>
      <Text
        fontSize={10}
        color="$colorFaint"
        fontStyle="italic"
        textAlign="center"
        accessibilityLabel={copy.notMedical}
      >
        {copy.notMedical}
      </Text>
    </YStack>
  );
}
