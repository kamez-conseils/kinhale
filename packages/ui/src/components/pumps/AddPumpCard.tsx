import * as React from 'react';
import { Stack, Text, XStack, YStack } from 'tamagui';

import { ScanIcon } from './icons';

export interface AddPumpCardProps {
  /** Libellé principal, ex. « Ajouter une pompe ». */
  label: string;
  /** Sous-titre, ex. « Scanner le code-barres · saisir manuellement ». */
  hint: string;
  mode?: 'mobile' | 'web';
  onPress?: (() => void) | undefined;
}

export function AddPumpCard({
  label,
  hint,
  mode = 'mobile',
  onPress,
}: AddPumpCardProps): React.JSX.Element {
  return (
    <Stack
      tag="button"
      cursor="pointer"
      backgroundColor="$surface2"
      borderRadius={16}
      padding={mode === 'web' ? 20 : 18}
      borderWidth={1.5}
      borderStyle="dashed"
      borderColor="$maint"
      width="100%"
      alignItems="stretch"
      flexDirection="column"
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(onPress ? { onPress } : {})}
      hoverStyle={{ backgroundColor: '$surface' }}
    >
      <XStack alignItems="center" gap={14}>
        <Text
          width={44}
          height={44}
          borderRadius={11}
          alignItems="center"
          justifyContent="center"
          color="$maint"
          display="flex"
          flexShrink={0}
          // halo doux 14 % de l'accent comme dans la maquette d'origine
          style={{
            background: 'color-mix(in oklch, var(--maint) 14%, var(--surface))',
          }}
        >
          <ScanIcon size={20} color="currentColor" />
        </Text>
        <YStack flex={1} alignItems="flex-start">
          <Text fontSize={14} fontWeight="600" color="$color">
            {label}
          </Text>
          <Text fontSize={11.5} color="$colorMore" marginTop={2}>
            {hint}
          </Text>
        </YStack>
      </XStack>
    </Stack>
  );
}
