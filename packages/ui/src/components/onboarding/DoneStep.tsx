import * as React from 'react';
import { Stack, Text, YStack } from 'tamagui';

import { CheckSmallIcon } from '../auth/icons';

interface DoneStepProps {
  copy: {
    title: string;
    sub: string;
    nextReminder: string;
  };
  childName: string;
}

// Dernier écran de l'onboarding (étape 4 dans la maquette, "done").
// Coche verte XL + titre personnalisé + récap prochain rappel.
export function DoneStep({ copy, childName }: DoneStepProps): React.JSX.Element {
  // `copy.title` peut contenir le placeholder "{name}" — on le résout ici.
  const title = copy.title.replace(/\{name\}/g, childName);

  return (
    <YStack flex={1} alignItems="center" justifyContent="center" gap={28} paddingVertical={48}>
      {/* Cercle de validation XL — accent OK avec halo vert pâle */}
      <Stack
        width={104}
        height={104}
        borderRadius={52}
        backgroundColor="$ok"
        alignItems="center"
        justifyContent="center"
        style={{ boxShadow: '0 0 0 12px var(--okSoft)' }}
      >
        <CheckSmallIcon size={48} color="#ffffff" />
      </Stack>

      <YStack alignItems="center" maxWidth={320} gap={10}>
        <Text
          tag="h1"
          margin={0}
          fontFamily="$heading"
          fontSize={28}
          fontWeight="500"
          letterSpacing={-0.56}
          color="$color"
          textAlign="center"
          lineHeight={32}
        >
          {title}
        </Text>
        <Text fontSize={14} color="$colorMore" textAlign="center" lineHeight={21}>
          {copy.sub}
        </Text>
      </YStack>

      <Stack
        paddingHorizontal={16}
        paddingVertical={10}
        borderRadius={12}
        backgroundColor="$maintSoft"
      >
        <Text fontSize={12} color="$maintInk" fontWeight="500" fontFamily="$mono">
          {copy.nextReminder}
        </Text>
      </Stack>
    </YStack>
  );
}
